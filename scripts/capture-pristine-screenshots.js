import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const tempDir = path.join(os.tmpdir(), "chrome-clean-shot-" + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  const proc = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempDir}`,
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--disable-gpu",
  ]);

  proc.on("error", (err) => console.error("Chrome process error:", err));

  let version = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version");
      version = await res.json();
      break;
    } catch {
      await sleep(250);
    }
  }

  if (!version) {
    proc.kill();
    throw new Error("Could not connect to Chrome CDP");
  }

  const newTabRes = await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" });
  const tabData = await newTabRes.json();
  const ws = new WebSocket(tabData.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CdpClient(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const screenshotDir = "c:/Users/Hp/Downloads/milestone-project-Sonolynx-rebrand/Autonomous-Clinical-Reporter/screenshots";

  async function hideDevOverlays() {
    await cdp.evaluate(`
      (() => {
        let style = document.getElementById('hide-dev-overlays');
        if (!style) {
          style = document.createElement('style');
          style.id = 'hide-dev-overlays';
          style.textContent = \`
            nextjs-portal, 
            [data-nextjs-toast], 
            #__next-build-watcher, 
            [data-nextjs-dialog-overlay],
            [data-nextjs-dialog],
            button[aria-label="Open Next.js Dev Tools"],
            div[data-nextjs-toast-errors],
            [data-sonner-toaster],
            [data-sonner-toast] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
          \`;
          document.head.appendChild(style);
        }
      })()
    `);
  }

  // 1. ADMIN DASHBOARD (1900 x 758)
  console.log("1. Capturing admin dashboard 1.PNG...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1900,
    height: 758,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/admin?role=admin" });
  await sleep(3000);
  await hideDevOverlays();
  await sleep(500);
  const shotAdmin = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(screenshotDir, "admin dashboard 1.PNG"), Buffer.from(shotAdmin.data, "base64"));
  console.log("-> Saved admin dashboard 1.PNG");

  // 2. SONOGRAPHER MODE (1920 x 982)
  console.log("2. Capturing sonographer mode.PNG...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 982,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/?role=sonographer" });
  await sleep(3500);
  await hideDevOverlays();

  // Populate kidneys values to match original findings exactly
  await cdp.evaluate(`
    (() => {
      function setNativeVal(el, val) {
        const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
        const proto = Object.getPrototypeOf(el);
        const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (protoSetter && valueSetter !== protoSetter) protoSetter.call(el, val);
        else if (valueSetter) valueSetter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Click Kidneys tab
      const buttons = Array.from(document.querySelectorAll('button'));
      const kidneyBtn = buttons.find(b => b.textContent && b.textContent.includes('Kidneys'));
      if (kidneyBtn) kidneyBtn.click();

      setTimeout(() => {
        const labels = Array.from(document.querySelectorAll('label, div'));
        const rightLabel = labels.find(l => l.textContent === 'Right (cm)');
        if (rightLabel) {
          const input = rightLabel.parentElement?.querySelector('input');
          if (input) setNativeVal(input, '11.3');
        }
        const leftLabel = labels.find(l => l.textContent === 'Left (cm)');
        if (leftLabel) {
          const input = leftLabel.parentElement?.querySelector('input');
          if (input) setNativeVal(input, '10.1');
        }

        const severeRadio = Array.from(document.querySelectorAll('label, span, input')).find(el => el.textContent === 'Severe');
        if (severeRadio) severeRadio.click();
      }, 300);
    })()
  `);
  await sleep(1000);
  await hideDevOverlays();
  const shotSono = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(screenshotDir, "sonographer mode.PNG"), Buffer.from(shotSono.data, "base64"));
  console.log("-> Saved sonographer mode.PNG");

  // 3. DOCTOR VIEW (1920 x 985)
  console.log("3. Capturing doctor view.PNG...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 985,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/?role=doctor" });
  await sleep(3500);
  await hideDevOverlays();
  await sleep(500);
  const shotDoctor = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(screenshotDir, "doctor view.PNG"), Buffer.from(shotDoctor.data, "base64"));
  console.log("-> Saved doctor view.PNG");

  // 4. DIFFERENT TYPES OF WORKSHEETS (1095 x 478)
  console.log("4. Capturing different types of of worksheets.png...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 982,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/?role=sonographer" });
  await sleep(3500);
  await hideDevOverlays();

  const dropdownOpened = await cdp.evaluate(`
    (() => {
      const trigger = document.querySelector('button[aria-label="Select report template"]');
      if (trigger) {
        trigger.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Dropdown trigger clicked:", dropdownOpened);
  await sleep(800);
  await hideDevOverlays();

  const shotWorksheets = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: {
      x: 0,
      y: 0,
      width: 1095,
      height: 478,
      scale: 1,
    },
  });
  fs.writeFileSync(path.join(screenshotDir, "different types of of worksheets.png"), Buffer.from(shotWorksheets.data, "base64"));
  console.log("-> Saved different types of of worksheets.png");

  // 5. GENERATE REPORT (1168 x 782)
  console.log("5. Capturing generate report.PNG...");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/?role=sonographer" });
  await sleep(3500);
  await hideDevOverlays();

  const reportBtnClicked = await cdp.evaluate(`
    (() => {
      const genBtn = document.querySelector('button[aria-label="Generate report"]');
      if (genBtn) {
        genBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Generate Report button clicked:", reportBtnClicked);
  await sleep(1500);
  await hideDevOverlays();

  const bounds = await cdp.evaluate(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const rect = dialog.getBoundingClientRect();
        const padX = Math.max(0, Math.round((1168 - rect.width) / 2));
        const padY = Math.max(0, Math.round((782 - rect.height) / 2));
        return {
          x: Math.max(0, Math.round(rect.x - padX)),
          y: Math.max(0, Math.round(rect.y - padY)),
          width: 1168,
          height: 782,
          scale: 1
        };
      }
      return { x: Math.round((1920 - 1168) / 2), y: 32, width: 1168, height: 782, scale: 1 };
    })()
  `);

  console.log("Dialog clip bounds:", bounds);
  const shotReport = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: bounds,
  });
  fs.writeFileSync(path.join(screenshotDir, "generate report.PNG"), Buffer.from(shotReport.data, "base64"));
  console.log("-> Saved generate report.PNG");

  ws.close();
  proc.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
  console.log("All 5 screenshots captured successfully!");
}

main().catch(console.error);
