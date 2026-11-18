# macOS build

Run **Build macOS** from the GitHub Actions tab, or push a `v*` tag. The workflow creates one DMG containing a universal Electron desktop app and one native monitoring-agent executable for each Mac CPU architecture.

The app starts the matching embedded agent automatically: `arm64` on Apple Silicon and `x64` on Intel Macs. Its data and configuration are stored in `~/Library/Application Support/SEWA/MonitoringAgent`; logs are in `~/Library/Logs/SEWA/MonitoringAgent`.

## Signing

To preserve macOS Keychain and privacy permissions between releases, add these repository secrets:

- `MACOS_CERT_P12`: base64-encoded PKCS#12 signing certificate
- `MACOS_CERT_PASSWORD`: password used when exporting the PKCS#12 file
- `MACOS_SIGNING_IDENTITY`: optional certificate common name. It defaults to `SEWA Monitoring Agent Signing`.

The certificate identity must remain unchanged for every release. A self-signed identity is enough to keep a stable local code requirement, but it does not satisfy Gatekeeper notarization. Direct distribution without Gatekeeper warnings requires an Apple Developer ID certificate and notarization.

On the first launch, macOS may request Screen Recording and Accessibility access for the monitoring agent. The agent uses these to determine the foreground application. It does not request microphone access.
