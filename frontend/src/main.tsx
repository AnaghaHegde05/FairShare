import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { ToastProvider } from "./components/ui/Toast";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </NotificationsProvider>
    </AuthProvider>
  </React.StrictMode>
);
