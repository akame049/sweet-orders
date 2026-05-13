import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CookiesProvider } from 'react-cookie';
import { AuthProvider } from './AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <CookiesProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </CookiesProvider>
    </React.StrictMode>
);