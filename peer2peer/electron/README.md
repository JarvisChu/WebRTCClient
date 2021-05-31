# electron

## how to use

```bash
npm install
npm start
```

## Q&A

### 1. MacOS getUserMedia throw error "Could not start video source"

This error is caused by Permission. Please grants the app launch electron video permission

e.g. If you launched electron in **Visual Studio Code**. 
(1) Open `System Preferences` -> `Security & Privacy` -> `Privacy`
(2) Selected **Camera** on left side
(3) Add `Visual Studio Code` to the permissioned App list on right side.
(4) Selected **Screen Recording**
(5) Add `Visual Studio Code` to the permissioned App list on right side.

> https://github.com/electron/electron/issues/14801
