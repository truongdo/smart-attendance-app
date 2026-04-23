# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Build cloud

   ```bash
    eas build --profile development --platform ios
   ```

3. If build local (no cloud)
```
npx expo run:ios --device
```

This generates the native ios/ folder (if using a managed workflow), runs pod install, builds in Xcode, and installs on your connected device. You'll still need Xcode signing set up as described before.
