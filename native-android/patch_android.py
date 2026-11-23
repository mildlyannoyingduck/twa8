#!/usr/bin/env python3
"""
Patches the Capacitor-generated `android/` project with This Week's native
Samsung Galaxy A07 blocker service, strict lock screen, 10-min exact alarms,
required AndroidManifest.xml permissions/components, v1.1 version bump, and
custom home-screen launcher icons.
"""

import os
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_DIR = os.path.join(ROOT, "android")
APP_DIR = os.path.join(ANDROID_DIR, "app")
RES_DIR = os.path.join(APP_DIR, "src", "main", "res")
JAVA_DEST = os.path.join(APP_DIR, "src", "main", "java", "com", "risinu", "thisweek")
MANIFEST_PATH = os.path.join(APP_DIR, "src", "main", "AndroidManifest.xml")
BUILD_GRADLE_PATH = os.path.join(APP_DIR, "build.gradle")

ICON_CANDIDATES = [
    os.path.join(ROOT, "native-android", "app-icon.png"),
    os.path.join(ROOT, "public", "assets", "app-icon.png"),
]

ANDROID_NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID_NS)


def a(attr: str) -> str:
    return f"{{{ANDROID_NS}}}{attr}"


def copy_java_sources() -> None:
    os.makedirs(JAVA_DEST, exist_ok=True)
    src_java_dir = os.path.join(ROOT, "native-android", "java", "com", "risinu", "thisweek")
    for fname in os.listdir(src_java_dir):
        if fname.endswith(".java"):
            shutil.copy2(os.path.join(src_java_dir, fname), os.path.join(JAVA_DEST, fname))

    shutil.copy2(
        os.path.join(ROOT, "native-android", "MainActivity.java"),
        os.path.join(JAVA_DEST, "MainActivity.java"),
    )
    print(f"Copied native Java sources into {JAVA_DEST}")


def bump_version() -> None:
    if not os.path.exists(BUILD_GRADLE_PATH):
        return
    with open(BUILD_GRADLE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"versionCode\s+\d+", "versionCode 12", content, count=1)
    content = re.sub(r'versionName\s+"[^"]+"', 'versionName "3.2.0"', content, count=1)
    with open(BUILD_GRADLE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated Android app version to 3.2.0 (versionCode 12)")


def generate_launcher_icons() -> None:
    icon_src = next((p for p in ICON_CANDIDATES if os.path.exists(p)), None)
    if not icon_src:
        print("No custom app-icon.png found; keeping default icons.")
        return

    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed; skipping custom icon generation.")
        return

    resample = getattr(Image, "Resampling", Image).LANCZOS
    base = Image.open(icon_src).convert("RGBA")

    # Standard densities (legacy icon px, adaptive foreground px)
    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }

    for density, (icon_px, fg_px) in densities.items():
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{density}")
        os.makedirs(mipmap_dir, exist_ok=True)

        # Legacy square & round launcher icons
        square = base.resize((icon_px, icon_px), resample)
        square.save(os.path.join(mipmap_dir, "ic_launcher.png"), "PNG")

        mask = Image.new("L", (icon_px, icon_px), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, icon_px - 1, icon_px - 1), fill=255)
        round_icon = Image.new("RGBA", (icon_px, icon_px), (0, 0, 0, 0))
        round_icon.paste(square, (0, 0), mask)
        round_icon.save(os.path.join(mipmap_dir, "ic_launcher_round.png"), "PNG")

        # Adaptive icon foreground (full-bleed edge-to-edge fill; crystal calendar sits inside 66% safe zone)
        fg_full = base.resize((fg_px, fg_px), resample)
        fg_full.save(os.path.join(mipmap_dir, "ic_launcher_foreground.png"), "PNG")

    # Match deep Arctic sapphire backdrop behind adaptive icon foreground
    values_dir = os.path.join(RES_DIR, "values")
    os.makedirs(values_dir, exist_ok=True)
    bg_xml = os.path.join(values_dir, "ic_launcher_background.xml")
    with open(bg_xml, "w", encoding="utf-8") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<resources>\n'
            '    <color name="ic_launcher_background">#0547B8</color>\n'
            '</resources>\n'
        )

    # Explicitly bind adaptive launcher XMLs to our generated foreground & background
    anydpi_dir = os.path.join(RES_DIR, "mipmap-anydpi-v26")
    os.makedirs(anydpi_dir, exist_ok=True)
    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n'
    )
    for fname in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi_dir, fname), "w", encoding="utf-8") as f:
            f.write(adaptive_xml)

    print(f"Generated v1.1 launcher icons from {icon_src}")


def patch_manifest() -> None:
    tree = ET.parse(MANIFEST_PATH)
    root = tree.getroot()

    permissions = [
        "android.permission.PACKAGE_USAGE_STATS",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.USE_EXACT_ALARM",
        "android.permission.VIBRATE",
        "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        "android.permission.WAKE_LOCK",
    ]

    existing_perms = {
        el.attrib.get(a("name"))
        for el in root.findall("uses-permission")
    }

    for perm_name in permissions:
        if perm_name not in existing_perms:
            el = ET.Element("uses-permission")
            el.set(a("name"), perm_name)
            root.insert(0, el)

    # Add <queries> so Android 11+ allows launching Calculator, Dialer, Contacts, Home
    if root.find("queries") is None:
        queries = ET.SubElement(root, "queries")
        for pkg in [
            "com.sec.android.app.popupcalculator",
            "com.samsung.android.calculator",
            "com.google.android.calculator",
            "com.android.calculator2",
            "com.samsung.android.dialer",
            "com.samsung.android.app.contacts",
            "com.sec.android.app.launcher",
        ]:
            p = ET.SubElement(queries, "package")
            p.set(a("name"), pkg)

        home_intent = ET.SubElement(queries, "intent")
        act = ET.SubElement(home_intent, "action")
        act.set(a("name"), "android.intent.action.MAIN")
        cat = ET.SubElement(home_intent, "category")
        cat.set(a("name"), "android.intent.category.HOME")

    app_el = root.find("application")
    if app_el is None:
        raise RuntimeError("Missing <application> in AndroidManifest.xml")

    app_el.set(a("allowBackup"), "true")

    # Ensure LockOverlayActivity exists
    existing_activities = {el.attrib.get(a("name")) for el in app_el.findall("activity")}
    if ".LockOverlayActivity" not in existing_activities and "com.risinu.thisweek.LockOverlayActivity" not in existing_activities:
        act = ET.SubElement(app_el, "activity")
        act.set(a("name"), "com.risinu.thisweek.LockOverlayActivity")
        act.set(a("exported"), "false")
        act.set(a("launchMode"), "singleTop")
        act.set(a("excludeFromRecents"), "true")
        act.set(a("theme"), "@style/Theme.AppCompat.NoActionBar")

    # Ensure BlockerForegroundService exists
    existing_services = {el.attrib.get(a("name")) for el in app_el.findall("service")}
    if ".BlockerForegroundService" not in existing_services and "com.risinu.thisweek.BlockerForegroundService" not in existing_services:
        svc = ET.SubElement(app_el, "service")
        svc.set(a("name"), "com.risinu.thisweek.BlockerForegroundService")
        svc.set(a("enabled"), "true")
        svc.set(a("exported"), "false")
        svc.set(a("foregroundServiceType"), "specialUse")
        prop = ET.SubElement(svc, "property")
        prop.set(a("name"), "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE")
        prop.set(a("value"), "Focus study lock enforcement for scheduled exam timetable")

    # Ensure Receivers exist
    existing_receivers = {el.attrib.get(a("name")) for el in app_el.findall("receiver")}
    if "com.risinu.thisweek.SlotReminderReceiver" not in existing_receivers:
        rec = ET.SubElement(app_el, "receiver")
        rec.set(a("name"), "com.risinu.thisweek.SlotReminderReceiver")
        rec.set(a("enabled"), "true")
        rec.set(a("exported"), "false")

    if "com.risinu.thisweek.BootReceiver" not in existing_receivers:
        brec = ET.SubElement(app_el, "receiver")
        brec.set(a("name"), "com.risinu.thisweek.BootReceiver")
        brec.set(a("enabled"), "true")
        brec.set(a("exported"), "true")
        ifilter = ET.SubElement(brec, "intent-filter")
        for action_name in [
            "android.intent.action.BOOT_COMPLETED",
            "android.intent.action.LOCKED_BOOT_COMPLETED",
            "android.intent.action.MY_PACKAGE_REPLACED",
        ]:
            act_el = ET.SubElement(ifilter, "action")
            act_el.set(a("name"), action_name)

    tree.write(MANIFEST_PATH, encoding="utf-8", xml_declaration=True)
    print(f"Patched {MANIFEST_PATH}")


if __name__ == "__main__":
    copy_java_sources()
    bump_version()
    generate_launcher_icons()
    patch_manifest()
