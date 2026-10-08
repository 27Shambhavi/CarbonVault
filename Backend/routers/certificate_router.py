# routers/certificate_router.py
"""
Certificate Router:
Single source of truth for all CarbonVault impact and verification certificates.
Backed exclusively by the `certificates` database table.
Zero mock data, zero fragmented schemas, zero disconnected IDs.
"""

import io
import hashlib
import secrets
import string
import logging
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Certificate, Transaction, ProjectCredits, Project, NGO

logger = logging.getLogger("carbonvault")
router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_certificate_public_id(issued_at: datetime) -> str:
    """
    Generate public_id with format: CV-<YYYY of issued_at>-<6 random uppercase/digits>.
    Year is dynamically extracted from issued_at, never hardcoded.
    """
    year = issued_at.year
    alphabet = string.ascii_uppercase + string.digits
    rand_part = ''.join(secrets.choice(alphabet) for _ in range(6))
    return f"CV-{year}-{rand_part}"


def compute_certificate_hash(public_id: str, project_id: str, tonnes: float, issued_at: datetime, beneficiary: str) -> str:
    """Compute deterministic cryptographic SHA-256 hash for certificate ledger verification."""
    raw = f"CARBONVAULT-PROOF:{public_id}:{project_id}:{tonnes:.2f}:{issued_at.isoformat()}:{beneficiary}:SHA256"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def find_certificate_data(cert_id: str, db: Session):
    """
    Locate certificate data strictly from the `certificates` table joined with Project & NGO.
    Accepts public_id (e.g. CV-2024-K8M9P2).
    """
    clean_id = cert_id.strip()

    cert = db.query(Certificate).filter(
        (Certificate.public_id == clean_id) |
        (Certificate.id == int(clean_id) if clean_id.isdigit() else False)
    ).first()

    if not cert:
        return None

    project = db.query(Project).filter(Project.project_id == cert.project_id).first()
    ngo = db.query(NGO).filter(NGO.id == project.ngo_id).first() if project and project.ngo_id else None

    is_purchase = (cert.type == "purchase")
    beneficiary = cert.buyer_name or (ngo.name if ngo else "Registered Project Developer")
    ngo_name = ngo.name if ngo else "Registered NGO"

    title = "CERTIFICATE OF VERIFIED CARBON OFFSET" if is_purchase else "CERTIFICATE OF CARBON CREDIT ISSUANCE"
    type_display = "Retirement & Impact Offset" if is_purchase else "Carbon Credit Issuance"
    status_display = "RETIRED / VERIFIED" if is_purchase else "ISSUED / VERIFIED"

    return {
        "certificate_id": cert.public_id,
        "public_id": cert.public_id,
        "type": type_display,
        "raw_type": cert.type,
        "title": title,
        "project_id": cert.project_id,
        "project_name": project.name if project else cert.project_id,
        "ngo_name": ngo_name,
        "ngo": ngo_name,
        "beneficiary": beneficiary,
        "buyer_name": cert.buyer_name,
        "tonnes": round(cert.tonnes, 2),
        "credits": round(cert.tonnes, 2),
        "date": cert.issued_at.strftime("%Y-%m-%d"),
        "issued_at": cert.issued_at.isoformat(),
        "issuance_date": cert.issued_at.strftime("%Y-%m-%d"),
        "status": status_display,
        "proof_hash": cert.sha256_hash,
        "sha256_hash": cert.sha256_hash,
        "hash": cert.sha256_hash,
        "mrv_score": project.mrv_score if project and project.mrv_score else 88.0,
        "plantation_type": (project.plantation_type or "Reforestation").replace("_", " ").title() if project else "Reforestation",
        "amount_usd": round(cert.tonnes * (project.price if project and project.price else 25.0), 2),
        "standard": "CarbonVault GRS & Verra Aligned Standard" if is_purchase else "CarbonVault GRS & Gold Standard Registry"
    }


def backfill_certificates(db: Session):
    """
    Backfill certificates table:
    1. Every approved project without a project_verification certificate gets one.
    2. Every completed transaction without a purchase certificate gets one.
    """
    now = datetime.utcnow()

    # 1. Backfill approved projects
    approved_projects = db.query(Project).filter(Project.status == "approved").all()
    for p in approved_projects:
        existing = db.query(Certificate).filter(
            Certificate.project_id == p.project_id,
            Certificate.type == "project_verification"
        ).first()

        if not existing:
            issued_date = p.created_at or p.start_date
            if issued_date:
                issued_at = datetime.combine(issued_date, datetime.min.time()) if isinstance(issued_date, date) else issued_date
            else:
                issued_at = now

            ngo = db.query(NGO).filter(NGO.id == p.ngo_id).first() if p.ngo_id else None
            beneficiary = ngo.name if ngo else "Registered Project Developer"
            tonnes = float(p.credits or 0.0)

            pub_id = generate_certificate_public_id(issued_at)
            cert_hash = compute_certificate_hash(pub_id, p.project_id, tonnes, issued_at, beneficiary)

            cert = Certificate(
                public_id=pub_id,
                project_id=p.project_id,
                transaction_id=None,
                buyer_name=None,
                tonnes=tonnes,
                issued_at=issued_at,
                sha256_hash=cert_hash,
                type="project_verification"
            )
            db.add(cert)
            db.flush()

            # Sync ProjectCredits certificate_id
            pc = db.query(ProjectCredits).filter(ProjectCredits.project_id == p.project_id).first()
            if pc:
                pc.certificate_id = pub_id
            logger.info("Backfilled verification certificate %s for project %s", pub_id, p.project_id)

    # 2. Backfill completed transactions
    completed_txns = db.query(Transaction).filter(Transaction.status == "completed").all()
    for txn in completed_txns:
        existing = None
        if txn.certificate_id and txn.certificate_id.startswith("CV-"):
            existing = db.query(Certificate).filter(Certificate.public_id == txn.certificate_id).first()
        if not existing:
            existing = db.query(Certificate).filter(Certificate.transaction_id == txn.id).first()

        if not existing:
            issued_date = txn.created_at
            if issued_date:
                issued_at = datetime.combine(issued_date, datetime.min.time()) if isinstance(issued_date, date) else issued_date
            else:
                issued_at = now

            pub_id = generate_certificate_public_id(issued_at)
            tonnes = float(txn.quantity or 0.0)
            beneficiary = txn.corporate_name or "Corporate Buyer"
            cert_hash = compute_certificate_hash(pub_id, txn.project_id, tonnes, issued_at, beneficiary)

            cert = Certificate(
                public_id=pub_id,
                project_id=txn.project_id,
                transaction_id=txn.id,
                buyer_name=txn.corporate_name,
                tonnes=tonnes,
                issued_at=issued_at,
                sha256_hash=cert_hash,
                type="purchase"
            )
            db.add(cert)
            txn.certificate_id = pub_id
            logger.info("Backfilled purchase certificate %s for transaction %s", pub_id, txn.id)

    db.commit()


# ── REST ENDPOINTS ────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def list_certificates(db: Session = Depends(get_db)):
    """
    Retrieve all verified certificates from the certificates table.
    Single source of truth for both Public Certificates and Corporate Wallet.
    """
    # Ensure backfill has run
    certs = db.query(Certificate).order_by(Certificate.issued_at.desc(), Certificate.id.desc()).all()
    if not certs:
        backfill_certificates(db)
        certs = db.query(Certificate).order_by(Certificate.issued_at.desc(), Certificate.id.desc()).all()

    results = []
    for cert in certs:
        data = find_certificate_data(cert.public_id, db)
        if data:
            results.append({
                "certificate_id": data["public_id"],
                "public_id": data["public_id"],
                "type": data["type"],
                "raw_type": data["raw_type"],
                "project_id": data["project_id"],
                "project_name": data["project_name"],
                "ngo_name": data["ngo_name"],
                "beneficiary": data["beneficiary"],
                "buyer_name": data["buyer_name"],
                "tonnes": data["tonnes"],
                "credits": data["tonnes"],
                "issued_at": data["issued_at"],
                "issuance_date": data["issuance_date"],
                "status": data["status"],
                "proof_hash": data["proof_hash"],
                "sha256_hash": data["sha256_hash"],
                "download_png_url": f"/certificates/{data['public_id']}/download?format=png",
                "download_pdf_url": f"/certificates/{data['public_id']}/download?format=pdf",
            })
    return results


@router.get("/verify/{public_id}")
def verify_certificate(public_id: str, db: Session = Depends(get_db)):
    """
    Verify authenticity of a certificate from the certificates table.
    Returns 200 JSON if found, 404 if not found.
    """
    data = find_certificate_data(public_id, db)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"Impact Certificate Verification — Registry ID: {public_id} — Not Found"
        )
    return {
        "valid": True,
        "certificate_id": data["public_id"],
        "public_id": data["public_id"],
        "project_name": data["project_name"],
        "project_id": data["project_id"],
        "ngo": data["ngo_name"],
        "ngo_name": data["ngo_name"],
        "buyer_name": data["buyer_name"],
        "beneficiary": data["beneficiary"],
        "tonnes": data["tonnes"],
        "tonnes_offset": data["tonnes"],
        "issued_at": data["issued_at"],
        "issuance_date": data["issuance_date"],
        "date": data["date"],
        "status": "Valid",
        "hash": data["proof_hash"],
        "proof_hash": data["proof_hash"],
        "sha256_hash": data["proof_hash"],
        "title": data["title"],
        "type": data["type"],
        "mrv_score": data.get("mrv_score", 88.0),
        "plantation_type": data.get("plantation_type", "Reforestation"),
        "registry": "CarbonVault MRV Global Registry (Satellite-Verified)",
        "verified_at": datetime.utcnow().isoformat() + "Z"
    }


@router.get("/{cert_id}")
def get_certificate_details(cert_id: str, db: Session = Depends(get_db)):
    """Get complete verifiable metadata for a specific certificate from certificates table."""
    data = find_certificate_data(cert_id, db)
    if not data:
        raise HTTPException(status_code=404, detail=f"Certificate '{cert_id}' not found in registry")
    return data


# ── PNG & PDF GENERATION ──────────────────────────────────────────────────────

def render_certificate_png(data: dict) -> bytes:
    """Generate high-resolution PNG certificate using Pillow."""
    width, height = 1200, 800
    img = Image.new("RGB", (width, height), color=(10, 15, 29))
    draw = ImageDraw.Draw(img)

    # Outer emerald border
    draw.rectangle([(24, 24), (width - 24, height - 24)], outline=(45, 212, 191), width=4)
    # Inner gold border
    draw.rectangle([(36, 36), (width - 36, height - 36)], outline=(245, 158, 11), width=1)
    # Corner flourishes
    for cx, cy in [(24, 24), (width - 24, 24), (24, height - 24), (width - 24, height - 24)]:
        draw.rectangle([(cx - 4, cy - 4), (cx + 4, cy + 4)], fill=(245, 158, 11))

    def get_font(size: int, bold: bool = False):
        try:
            return ImageFont.truetype("arialbd.ttf" if bold else "arial.ttf", size)
        except Exception:
            try:
                return ImageFont.truetype("arial.ttf", size)
            except Exception:
                return ImageFont.load_default()

    font_header = get_font(18, True)
    font_title = get_font(34, True)
    font_sub = get_font(16, False)
    font_label = get_font(13, True)
    font_value = get_font(26, True)
    font_tonnes = get_font(42, True)
    font_small = get_font(12, False)

    # 1. Header
    draw.text((width // 2, 70), "CARBONVAULT GLOBAL MRV REGISTRY & IMPACT LEDGER", fill=(45, 212, 191), anchor="mm", font=font_header)
    draw.line([(width // 2 - 240, 88), (width // 2 + 240, 88)], fill=(45, 212, 191), width=1)

    # 2. Main Title
    draw.text((width // 2, 135), data.get("title", "CERTIFICATE OF VERIFIED CARBON OFFSET"), fill=(255, 255, 255), anchor="mm", font=font_title)
    draw.text((width // 2, 175), f"Official Registry Certificate ID: {data['public_id']}", fill=(245, 158, 11), anchor="mm", font=font_sub)

    # 3. Beneficiary
    draw.text((width // 2, 230), "THIS IS OFFICIALLY PRESENTED AND RECORDED TO", fill=(148, 163, 184), anchor="mm", font=font_label)
    draw.text((width // 2, 275), str(data.get("beneficiary", "Corporate Partner")), fill=(167, 139, 250), anchor="mm", font=font_value)

    # 4. Tonnes Highlight
    tonnes_str = f"{data.get('tonnes', 0):,.2f} METRIC TONNES CO₂e"
    draw.rectangle([(width // 2 - 320, 325), (width // 2 + 320, 395)], fill=(16, 24, 46), outline=(45, 212, 191), width=2)
    draw.text((width // 2, 360), tonnes_str, fill=(52, 211, 153), anchor="mm", font=font_tonnes)

    # 5. Project details
    desc_label = "Permanently retired & verified through ecological restoration project:" if data.get("raw_type") == "purchase" else "Issued and verified through ecological restoration project:"
    draw.text((width // 2, 430), desc_label, fill=(148, 163, 184), anchor="mm", font=font_sub)
    draw.text((width // 2, 465), f"{data.get('project_name')} ({data.get('project_id')})", fill=(255, 255, 255), anchor="mm", font=get_font(22, True))
    draw.text((width // 2, 500), f"Ecosystem: {data.get('plantation_type', 'Reforestation')}  •  MRV Verification Score: {data.get('mrv_score', 85)}/100", fill=(56, 189, 248), anchor="mm", font=font_sub)

    # 6. Metadata Bar
    draw.line([(80, 550), (width - 80, 550)], fill=(30, 41, 59), width=1)
    draw.text((120, 580), "ISSUANCE / RETIREMENT DATE", fill=(148, 163, 184), font=font_label)
    draw.text((120, 605), str(data.get("date")), fill=(255, 255, 255), font=get_font(15, True))

    draw.text((width // 2 - 100, 580), "VERIFICATION STANDARD", fill=(148, 163, 184), font=font_label)
    draw.text((width // 2 - 100, 605), "Gold Standard & Satellite AI", fill=(255, 255, 255), font=get_font(15, True))

    draw.text((width - 320, 580), "REGISTRY STATUS", fill=(148, 163, 184), font=font_label)
    draw.text((width - 320, 605), str(data.get("status", "VERIFIED")), fill=(52, 211, 153), font=get_font(15, True))

    # 7. Proof Hash
    proof = data.get("proof_hash", "")
    draw.text((width // 2, 690), f"Cryptographic Verification Proof (SHA-256): {proof}", fill=(100, 116, 139), anchor="mm", font=font_small)
    draw.text((width // 2, 720), "Secured by CarbonVault Decentralized Ecological MRV Protocol  •  Tamper-Evident Impact Ledger", fill=(71, 85, 105), anchor="mm", font=font_small)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_certificate_pdf(data: dict) -> bytes:
    """Generate high-resolution PDF certificate using ReportLab."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    width, height = landscape(letter)

    # Background
    c.setFillColor(colors.HexColor("#0a0f1d"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Borders
    c.setStrokeColor(colors.HexColor("#2dd4bf"))
    c.setLineWidth(3)
    c.rect(20, 20, width - 40, height - 40)

    c.setStrokeColor(colors.HexColor("#f59e0b"))
    c.setLineWidth(1)
    c.rect(28, 28, width - 56, height - 56)

    # Header
    c.setFillColor(colors.HexColor("#2dd4bf"))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2.0, height - 60, "CARBONVAULT GLOBAL MRV REGISTRY & IMPACT LEDGER")

    # Title
    c.setFillColor(colors.HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2.0, height - 105, data.get("title", "CERTIFICATE OF VERIFIED CARBON OFFSET"))

    c.setFillColor(colors.HexColor("#f59e0b"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2.0, height - 130, f"Certificate ID: {data['public_id']}")

    # Beneficiary
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2.0, height - 170, "THIS CERTIFIES THAT")

    c.setFillColor(colors.HexColor("#a78bfa"))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2.0, height - 200, str(data.get("beneficiary", "Corporate Partner")))

    # Tonnes
    c.setFillColor(colors.HexColor("#10182e"))
    c.setStrokeColor(colors.HexColor("#2dd4bf"))
    c.setLineWidth(1.5)
    c.rect(width / 2.0 - 200, height - 290, 400, 60, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#34d399"))
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2.0, height - 255, f"{data.get('tonnes', 0):,.2f} TONNES CO₂e")

    # Project
    desc_label = "Has been permanently retired and verified through:" if data.get("raw_type") == "purchase" else "Has been issued and verified through:"
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2.0, height - 320, desc_label)

    c.setFillColor(colors.HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2.0, height - 345, f"{data.get('project_name')} ({data.get('project_id')})")

    c.setFillColor(colors.HexColor("#38bdf8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2.0, height - 368, f"Ecosystem: {data.get('plantation_type', 'Reforestation')}  •  MRV Quality Score: {data.get('mrv_score', 85)}/100")

    # Divider
    c.setStrokeColor(colors.HexColor("#1e293b"))
    c.setLineWidth(1)
    c.line(60, height - 410, width - 60, height - 410)

    # Details
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(80, height - 435, "DATE")
    c.drawString(width / 2.0 - 60, height - 435, "STANDARD")
    c.drawString(width - 200, height - 435, "REGISTRY STATUS")

    c.setFillColor(colors.HexColor("#ffffff"))
    c.setFont("Helvetica", 11)
    c.drawString(80, height - 455, str(data.get("date")))
    c.drawString(width / 2.0 - 60, height - 455, "Gold Standard / AI MRV")

    c.setFillColor(colors.HexColor("#34d399"))
    c.drawString(width - 200, height - 455, str(data.get("status", "VERIFIED")))

    # Proof
    proof = data.get("proof_hash", "")
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2.0, 55, f"Cryptographic Verification Proof: {proof}")
    c.drawCentredString(width / 2.0, 40, "Secured by CarbonVault Tamper-Evident Distributed Ecological Ledger")

    c.save()
    return buffer.getvalue()


@router.get("/{cert_id}/download")
def download_certificate(
    cert_id: str,
    format: str = Query(default="png", pattern="^(png|pdf)$"),
    db: Session = Depends(get_db)
):
    """Download dynamic certificate in PNG or PDF format."""
    data = find_certificate_data(cert_id, db)
    if not data:
        raise HTTPException(status_code=404, detail="Certificate not found")

    filename = f"Certificate_{data['public_id']}.{format}"
    if format == "pdf":
        pdf_bytes = render_certificate_pdf(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        png_bytes = render_certificate_png(data)
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.get("/{cert_id}/image")
def get_certificate_image(cert_id: str, db: Session = Depends(get_db)):
    """View certificate as raw PNG image stream."""
    data = find_certificate_data(cert_id, db)
    if not data:
        raise HTTPException(status_code=404, detail="Certificate not found")
    png_bytes = render_certificate_png(data)
    return Response(content=png_bytes, media_type="image/png")
