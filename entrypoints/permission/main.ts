const button = document.querySelector<HTMLButtonElement>("#allow")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

button.addEventListener("click", async () => {
  status.textContent = "Waiting for Chrome…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    button.disabled = true;
    status.textContent = "Done! Zoya can hear you now. This tab will close.";
    setTimeout(() => window.close(), 2000);
  } catch {
    status.textContent =
      "Chrome blocked the microphone. Click the icon at the left of the address bar, set Microphone to Allow, then press the button again.";
  }
});