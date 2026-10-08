import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_verification():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--window-size=1600,1000")
    chrome_options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=chrome_options)
    results = []

    def check_current_view(role, page_label):
        time.sleep(2)
        body = driver.find_element(By.TAG_NAME, "body").text
        
        # Check error boundary
        has_crash = "Something went wrong loading this page" in body
        
        # Check console logs for ReferenceErrors or Uncaught errors
        logs = driver.get_log("browser")
        fatal_logs = [l["message"] for l in logs if "ReferenceError" in l["message"] or "is not defined" in l["message"]]
        
        if has_crash or fatal_logs:
            err = fatal_logs[0] if fatal_logs else "Error boundary displayed"
            print(f"  [FAIL] {role} -> {page_label}: {err}")
            results.append((role, page_label, "FAIL", err))
            return False
        else:
            print(f"  [PASS] {role} -> {page_label}")
            results.append((role, page_label, "PASS", "Loaded OK"))
            return True

    def login_role(role_key):
        driver.get("https://final-carbon-vault.vercel.app")
        time.sleep(2)
        
        # If logged in, logout first
        logout_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Logout') or contains(., 'Log out') or contains(., 'Sign out')]")
        if logout_btns:
            driver.execute_script("arguments[0].click();", logout_btns[0])
            time.sleep(2)

        if role_key == "public":
            pub_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Explore Public Transparency')]"))
            )
            driver.execute_script("arguments[0].click();", pub_btn)
        else:
            role_map = {
                "admin": ("Admin", "Platform HQ"),
                "ngo": ("NGO", "Project Organization"),
                "corporate": ("Corporate", "Carbon Buyer")
            }
            lbl, desc = role_map[role_key]
            # Click role card
            role_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{lbl}') and contains(., '{desc}')]"))
            )
            driver.execute_script("arguments[0].click();", role_btn)
            time.sleep(1)
            # Click Access Dashboard
            submit_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Access Dashboard')]"))
            )
            driver.execute_script("arguments[0].click();", submit_btn)
        time.sleep(3)

    try:
        # 1. CORPORATE
        print("\n=== TESTING CORPORATE ROLE ===")
        login_role("corporate")
        check_current_view("Corporate", "Dashboard")
        
        # Click each corporate sidebar item
        corp_items = ["Marketplace", "Footprint Calculator", "My Wallet", "ESG Reports", "Dashboard"]
        for item in corp_items:
            try:
                btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//nav//button[contains(., '{item}')]"))
                )
                driver.execute_script("arguments[0].click();", btn)
                check_current_view("Corporate", item)
                if item == "Marketplace":
                    driver.save_screenshot("corporate_marketplace_verified.png")
                    print("     [SCREENSHOT] Saved corporate_marketplace_verified.png")
            except Exception as e:
                print(f"  [ERROR] Could not navigate to Corporate -> {item}: {e}")
                results.append(("Corporate", item, "FAIL", str(e)))

        # 2. NGO
        print("\n=== TESTING NGO ROLE ===")
        login_role("ngo")
        check_current_view("NGO", "Dashboard")
        
        ngo_items = ["My Projects", "New Project", "Site Suitability", "Marketplace", "Dashboard"]
        for item in ngo_items:
            try:
                btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//nav//button[contains(., '{item}')]"))
                )
                driver.execute_script("arguments[0].click();", btn)
                check_current_view("NGO", item)
            except Exception as e:
                print(f"  [ERROR] Could not navigate to NGO -> {item}: {e}")
                results.append(("NGO", item, "FAIL", str(e)))

        # 3. ADMIN
        print("\n=== TESTING ADMIN ROLE ===")
        login_role("admin")
        check_current_view("Admin", "Dashboard")
        
        admin_items = ["User Management", "Project Approvals", "Pricing Engine", "Analytics", "Dashboard"]
        for item in admin_items:
            try:
                btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//nav//button[contains(., '{item}')]"))
                )
                driver.execute_script("arguments[0].click();", btn)
                check_current_view("Admin", item)
            except Exception as e:
                print(f"  [ERROR] Could not navigate to Admin -> {item}: {e}")
                results.append(("Admin", item, "FAIL", str(e)))

        # 4. PUBLIC
        print("\n=== TESTING PUBLIC ROLE ===")
        login_role("public")
        check_current_view("Public", "Impact Stats")
        
        pub_items = ["Leaderboard", "Marketplace View", "Climate Insights", "Certificates", "Audit Trail", "Impact Stats"]
        for item in pub_items:
            try:
                btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//nav//button[contains(., '{item}')]"))
                )
                driver.execute_script("arguments[0].click();", btn)
                check_current_view("Public", item)
            except Exception as e:
                print(f"  [ERROR] Could not navigate to Public -> {item}: {e}")
                results.append(("Public", item, "FAIL", str(e)))

    finally:
        driver.quit()

    print("\n" + "="*70)
    print("ALL ROLES LIVE SITE VERIFICATION SUMMARY:")
    print("="*70)
    print(f"{'Role':<12} | {'Sidebar Item':<25} | {'Status':<6} | {'Details'}")
    print("-" * 70)
    for role, name, status, notes in results:
        print(f"{role:<12} | {name:<25} | {status:<6} | {notes}")

if __name__ == "__main__":
    run_verification()
