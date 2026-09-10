# Chetect Mobile App

`myApp` is the Expo and React Native mobile client for Chetect, an examination platform with computer-vision-assisted monitoring. It provides separate student and invigilator/admin portals and connects to Supabase, the Chetect WebSocket gateway, and the computer-vision detector API.

## Project Architecture

```text
myApp (Expo / React Native)
  |- Student examination portal
  |- Invigilator monitoring portal
  |- Camera and evidence capture
  `- Supabase authentication and data access
          |
          `- chetectWebsocket (WebSocket gateway)
                    |
                    `- CheatingDetector (FastAPI computer-vision API)
```

### Student Features

- Role-based authentication and profile management
- Registered examination schedule
- Examination questions and answer submission
- Camera-based monitoring during an examination
- Results, session history, notifications, and support

### Invigilator/Admin Features

- Examination creation and management
- Live monitoring dashboard
- Student risk levels and suspicious-event details
- Evidence clips, reports, and audit history
- Notifications and suspicious-activity alert toasts
- Human review and integrity decisions

Automated scores and alerts are review indicators, not proof of cheating. Final decisions remain with an authorised human reviewer.

## Technology Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- Supabase Auth, PostgreSQL, Storage, and Realtime
- Expo Camera and Expo AV
- WebSocket communication

## Requirements

- Node.js 18 or newer
- npm
- Android Studio and an Android emulator, or a physical Android device
- Xcode and an iOS simulator for iOS development
- A Supabase project configured with the Chetect schema and migrations

## Installation

```powershell
cd C:\Users\USER\Documents\chetect\myApp
npm install
```

The project reads public configuration from `.env`. The active configuration uses the deployed Render services:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_CHEATING_DETECTOR_URL=https://cheatingmonitoringaibackuponrender-111222.onrender.com
EXPO_PUBLIC_CHEATING_DETECTOR_WS_URL=wss://chetectwebsocket.onrender.com/ws/analyze
```

Do not commit Supabase service-role keys, database passwords, or other private secrets. The mobile bundle should contain only the public Supabase URL and anon key.

## Run the App

```powershell
cd C:\Users\USER\Documents\chetect\myApp
npx expo start
```

Clear the Metro and Expo cache after changing `.env`:

```powershell
npx expo start -c
```

Run on a specific platform:

```powershell
npm run android
npm run ios
npm run web
```

Check the deployed Render services:

```powershell
Invoke-WebRequest -Uri 'https://cheatingmonitoringaibackuponrender-111222.onrender.com/health' -UseBasicParsing
Invoke-WebRequest -Uri 'https://chetectwebsocket.onrender.com/health' -UseBasicParsing
```

Both services should respond with HTTP 200 and a healthy status response.

## Local Backend Development

The mobile app can also connect to local services. Set these values in `.env` when required:

```env
EXPO_PUBLIC_CHEATING_DETECTOR_URL=http://10.232.97.48:8000
EXPO_PUBLIC_CHEATING_DETECTOR_WS_URL=ws://10.232.97.48:8001/ws/analyze
```

Start the detector:

```powershell
cd C:\Users\USER\Downloads\CheatingDetector
.\venv\Scripts\Activate.ps1
uvicorn cheating_detector.api.app:app --host 0.0.0.0 --port 8000 --reload
```

Start the WebSocket gateway:

```powershell
cd C:\Users\USER\Downloads\chetectWebsocket\chetectWebsocket
.\.venv\Scripts\Activate.ps1
$env:MODEL_API_BASE_URL="http://127.0.0.1:8000"
$env:ALLOWED_ORIGINS="*"
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

For an Android emulator, use `10.0.2.2` instead of `127.0.0.1`. For a physical device, use the computer's LAN IP address and ensure both devices are on the same network.

## Database Commands

```powershell
npm run db:status
npm run db:apply
npm run db:apply-migration
npm run db:fix-storage
npm run seed:auth-users
```

## Validation

```powershell
npm run lint
```

## Route Structure

```text
app/
|- index.tsx                         # Student/invigilator portal selection
|- sign-in.tsx                       # Student sign-in
|- invigilator-sign-in.tsx           # Invigilator sign-in
|- exam-session.tsx                  # Student examination session
|- (tabs)/                           # Student portal
|  |- index.tsx                      # Student dashboard
|  |- results.tsx
|  |- session-history.tsx
|  |- profile.tsx
|  `- notifications.tsx
`- (invigilator-tabs)/               # Invigilator/admin portal
   |- index.tsx                      # Dashboard
   |- monitor.tsx                    # Live monitoring
   |- create.tsx                     # Create examination
   |- reports.tsx
   |- report-details.tsx
   |- session-details.tsx
   |- audit-history.tsx
   `- profile.tsx
```

## Important Configuration Notes

- Restart Expo after changing environment variables.
- Use `https` and `wss` endpoints for Render deployments.
- Supabase Realtime must be enabled for tables used by live alert toasts.
- Authenticated users must satisfy the relevant Supabase row-level security policies.
- Camera permissions are required for monitored examinations.
- The detector and gateway must be reachable from the device running the app.

## Related Projects

- `CheatingDetector`: Python FastAPI computer-vision analysis service
- `chetectWebsocket`: Python WebSocket gateway
- `docs/final.md`: Final documentation values, verified test results, commands, and report-ready text

## Useful Documentation

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [Supabase documentation](https://supabase.com/docs)
