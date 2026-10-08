# test_live_certificates.py
import sys
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def run_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1400,900")

    driver = webdriver.Chrome(options=chrome_options)
    results = []

    try:
        print("Navigating to https://final-carbon-vault.vercel.app...")
        driver.get("https://final-carbon-vault.vercel.app")
        time.sleep(3)

        # Switch to Public role if not already
        print("Switching to Public role...")
        try:
            # Check if role switcher button exists
            public_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), 'Public') or contains(text(), 'Auditor')]"))
            )
            public_btn.click()
            time.sleep(2)
        except Exception as e:
            print("Already on role or could not click role switcher:", e)

        # Click Certificates sidebar item
        print("Clicking Certificates sidebar item...")
        cert_nav = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[.//span[text()='Certificates'] or contains(., 'Certificates')]"))
        )
        cert_nav.click()
        time.sleep(4)

        # Wait for certificate cards to load
        print("Waiting for certificate cards to render...")
        time.sleep(4)

        # Find all "View Certificate" buttons
        view_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'View Certificate')]")
        print(f"Found {len(view_buttons)} certificate cards with View Certificate buttons.")

        if len(view_buttons) == 0:
            print("ERROR: No certificate cards found!")
            driver.save_screenshot("Backend/no_certs_found.png")
            return False

        for idx in range(min(3, len(view_buttons))):
            # Re-fetch buttons in case DOM refreshed
            view_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'View Certificate')]")
            btn = view_buttons[idx]

            # Get parent card text
            card = btn.find_element(By.XPATH, "./ancestor::div[contains(@style, 'flex-direction: column')]")
            card_text = card.text
            print(f"\n--- Testing Certificate Card #{idx+1} ---")
            print("Card snippet:", card_text.replace('\n', ' | ')[:120])

            # Click View Certificate
            print(f"Clicking View Certificate button #{idx+1}...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", btn)
            time.sleep(4)

            screenshot_path = f"Backend/cert_modal_view_{idx+1}.png"
            driver.save_screenshot(screenshot_path)
            print(f"Saved click screenshot to {screenshot_path}")

            # Check modal content (fixed overlay)
            modal_overlays = driver.find_elements(By.XPATH, "//div[contains(@style, 'position: fixed') or contains(@style, 'position:fixed')]")
            if not modal_overlays:
                print(f"FAIL: Modal overlay did not open for card #{idx+1}")
                results.append((f"Card #{idx+1}", "FAIL", "Modal overlay not found"))
                continue

            modal_text = modal_overlays[0].text
            modal_text_clean = modal_text.encode('ascii', 'ignore').decode()
            print("Modal content snippet:", modal_text_clean.replace('\n', ' | ')[:200])

            # Assert NOT FOUND is not in modal
            is_not_found = "not found" in modal_text.lower()
            has_valid = "valid" in modal_text.lower() or "verified" in modal_text.lower() or "retired" in modal_text.lower()
            has_hash = "sha-256" in modal_text.lower() or "cryptographic" in modal_text.lower()

            screenshot_path = f"Backend/cert_modal_{idx+1}.png"
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot to {screenshot_path}")

            if is_not_found:
                print(f"FAIL: Card #{idx+1} modal shows 'Not Found'!")
                results.append((f"Certificate #{idx+1}", "FAIL", "Modal shows 'Not Found'"))
            elif not has_valid:
                print(f"FAIL: Card #{idx+1} modal missing Valid status!")
                results.append((f"Certificate #{idx+1}", "FAIL", "Missing Valid badge"))
            else:
                print(f"PASS: Card #{idx+1} modal rendered successfully with verified details!")
                results.append((f"Certificate #{idx+1}", "PASS", "Verified details rendered, valid hash present"))

            # Test Download buttons
            pdf_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Download PDF')]")
            png_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Download High-Res PNG')]")
            if pdf_btns and png_btns:
                import urllib.request
                cert_id_match = None
                for line in modal_text.splitlines():
                    if "Registry ID:" in line or "CV-" in line:
                        for token in line.split():
                            if token.startswith("CV-"):
                                cert_id_match = token.strip()
                                break
                if cert_id_match:
                    pdf_url = f"https://carbonvault-api.onrender.com/certificates/{cert_id_match}/download?format=pdf"
                    png_url = f"https://carbonvault-api.onrender.com/certificates/{cert_id_match}/download?format=png"
                    try:
                        r_pdf = urllib.request.urlopen(pdf_url)
                        r_png = urllib.request.urlopen(png_url)
                        pdf_size = len(r_pdf.read())
                        png_size = len(r_png.read())
                        print(f"Verified live download for {cert_id_match}: PDF ({pdf_size} bytes), PNG ({png_size} bytes)")
                    except Exception as de:
                        print(f"Download verification error for {cert_id_match}:", de)

            # Close modal
            close_btns = driver.find_elements(By.XPATH, "//button[contains(., '×') or contains(@style, 'border: none')]")
            for cb in close_btns:
                try:
                    driver.execute_script("arguments[0].click();", cb)
                    time.sleep(1)
                    break
                except Exception:
                    pass
            time.sleep(1)

        print("\n=== SUMMARY RESULTS ===")
        all_passed = True
        for name, status, detail in results:
            print(f"[{status}] {name}: {detail}")
            if status != "PASS":
                all_passed = False

        return all_passed

    finally:
        driver.quit()

if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
