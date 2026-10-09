# Teampot Mobile

Expo app for Teampot, built with React Native, TypeScript, and Expo Router.

## Run on iPhone with Expo Go

1. Install dependencies:

   ```sh
   cd mobile
   npm install
   ```

2. Start Expo:

   ```sh
npx expo start
```

3. Open Expo Go on the iPhone and scan the QR code. Keep the iPhone and this Mac on the same Wi-Fi.

4. If the QR code cannot reach the Mac on local Wi-Fi, use a tunnel:

   ```sh
npx expo start --tunnel
```

If Metro reports `EMFILE: too many open files, watch`, install Watchman or raise the shell limit before starting Expo:

```sh
ulimit -n 65536
npx expo start
```

The API defaults to `https://teampot.vercel.app`. To point at another API:

```sh
EXPO_PUBLIC_API_BASE=https://your-host.example npx expo start
```

Native demo sign-in stores the `tp_session` cookie from `/api/auth/demo` in Expo SecureStore and sends it back as a `cookie` header.

## Web Test Build

```sh
cd mobile
npx tsc --noEmit
npx expo export --platform web
npm run screenshot:sam
```

The screenshot script serves `mobile/dist` and writes `mobile/screenshots/sam-money.png` at `390x844`.

## Native Build Later

Expo Go is enough for this brief. A distributable iOS build should use EAS Build later, which requires an Expo account and project setup:

```sh
npx eas build:configure
npx eas build --platform ios
```
