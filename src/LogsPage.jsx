import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const API_URL = '/api'; 

const LogsPage = () => {
    const { isAdmin } = useAuth();
    const [logs, setLogs] = useState([]);
    const [suspects, setSuspects] = useState([]);
    const [tab, setTab] = useState('logs');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, suspectsRes] = await Promise.all([
                fetch(`${API_URL}/logs`, { credentials: 'include' }),
                fetch(`${API_URL}/logs/suspicious`, { credentials: 'include' })
            ]);
            setLogs(await logsRes.json());
            setSuspects(await suspectsRes.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const resolve = async (id) => {
        await fetch(`${API_URL}/logs/suspicious/${id}/resolve`, { method: 'PUT', credentials: 'include' });
        fetchData();
    };

    if (!isAdmin()) return <div style={{ textAlign: 'center', padding: '50px' }}>🔒 Acces interzis</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2>🛡️ Panou Admin — Logs</h2>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => setTab('logs')}
                    style={{
                        padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                        background: tab === 'logs' ? '#7B1FA2' : '#eee', color: tab === 'logs' ? 'white' : '#333'
                    }}>
                    📋 Toate Logurile ({logs.length})
                </button>
                <button onClick={() => setTab('suspects')}
                    style={{
                        padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                        background: tab === 'suspects' ? '#f44336' : '#eee', color: tab === 'suspects' ? 'white' : '#333'
                    }}>
                    🚨 Suspecți ({suspects.length})
                </button>
                <button onClick={fetchData} style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid #ddd', cursor: 'pointer', marginLeft: 'auto' }}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? <p>Se încarcă...</p> : tab === 'logs' ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <thead style={{ background: '#7B1FA2', color: 'white' }}>
                            <tr>
                                <th style={{ padding: '12px' }}>Timp</th>
                                <th style={{ padding: '12px' }}>User</th>
                                <th style={{ padding: '12px' }}>Rol</th>
                                <th style={{ padding: '12px' }}>Acțiune</th>
                                <th style={{ padding: '12px' }}>IP</th>
                                <th style={{ padding: '12px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f0e6f6', background: log.suspicious ? '#fff3e0' : 'white' }}>
                                    <td style={{ padding: '10px', fontSize: '0.8rem', color: '#888' }}>
                                        {new Date(log.createdAt).toLocaleString('ro-RO')}
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{log.username}</td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{ background: log.role === 'ADMIN' ? '#7B1FA2' : '#4caf50', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>
                                            {log.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{log.action}</td>
                                    <td style={{ padding: '10px', fontSize: '0.8rem', color: '#666' }}>{log.ip}</td>
                                    <td style={{ padding: '10px' }}>
                                        {log.suspicious
                                            ? <span style={{ color: '#f44336', fontWeight: 'bold' }}>⚠️ Suspect</span>
                                            : <span style={{ color: '#4caf50' }}>✓ OK</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {suspects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>✅ Niciun utilizator suspect</div>
                    ) : suspects.map(s => (
                        <div key={s.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #f44336' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px', color: '#f44336' }}>🚨 {s.username}</h4>
                                    <p style={{ margin: '0 0 5px', color: '#666' }}>Motiv: <strong>{s.reason}</strong></p>
                                    <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>
                                        Detectat: {new Date(s.createdAt).toLocaleString('ro-RO')} · {s.actionCount} acțiuni
                                    </p>
                                </div>
                                <button onClick={() => resolve(s.id)}
                                    style={{ background: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer' }}>
                                    ✓ Rezolvat
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LogsPage;