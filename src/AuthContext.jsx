import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = 'https://172.30.160.1:5000/api'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Verifică dacă userul e deja logat
        fetch(`${API_URL}/auth/me`, { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setUser(data); })
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        setUser(data.user);
        return { success: true };
    };

    const register = async (username, email, password) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        setUser(data.user);
        return { success: true };
    };

    const logout = async () => {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
        setUser(null);
    };

    const isAdmin = () => {
        if (!user?.roles) return false;
        return user.roles.some(r =>
            typeof r === 'string'
                ? r.toLowerCase() === 'admin'
                : r?.name?.toLowerCase() === 'admin'
        );
    };
    const hasPermission = (perm) => user?.permissions?.includes(perm);

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);