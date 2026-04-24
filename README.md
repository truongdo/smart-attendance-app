# Project git repos
- git@github.com:truongdo/fsi-chamcong.git - admin/web user app
- git@github.com:truongdo/smart-attendance-firmware.git - firmware
- git@github.com:truongdo/smart-attendance-app.git - react native app


## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. If build local (no cloud)
```
npx expo run:ios --device
```

This generates the native ios/ folder (if using a managed workflow), runs pod install, builds in Xcode, and installs on your connected device. You'll still need Xcode signing set up as described before.
