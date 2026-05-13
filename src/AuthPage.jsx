import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const AuthPage = ({ onSuccess }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        let result;
        if (mode === 'login') {
            result = await login(form.email, form.password);
        } else {
            result = await register(form.username, form.email, form.password);
        }

        setLoading(false);
        if (result.success) {
            onSuccess();
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="auth-overlay">
            <div className="auth-card">
                <div className="auth-logo">🍰 SweetOrders</div>
                <h2>{mode === 'login' ? 'Bine ai revenit!' : 'Creează cont'}</h2>

                {error && <div className="auth-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === 'register' && (
                        <input
                            placeholder="Username"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            required
                        />
                    )}
                    <input
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Parolă"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        required
                    />
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? '...' : mode === 'login' ? 'Intră în cont' : 'Înregistrează-te'}
                    </button>
                </form>

                <div className="auth-switch">
                    {mode === 'login' ? (
                        <p>Nu ai cont? <button onClick={() => setMode('register')}>Înregistrează-te</button></p>
                    ) : (
                        <p>Ai deja cont? <button onClick={() => setMode('login')}>Loghează-te</button></p>
                    )}
                </div>

                <div className="auth-hint">
                    <small>Admin demo: admin@sweetorders.com / admin123</small>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;