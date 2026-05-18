import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const API_URL = 'https://10.189.173.235:5000/api';
const SOCKET_URL = 'https://10.189.173.235:5000';

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const socketRef = useRef(null);
    const lastParamsRef = useRef({ page: 1, categoryId: '' }); // ← ține minte ultimii parametri

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
    }, []);

    const fetchProducts = useCallback(async (page = lastParamsRef.current.page, categoryId = lastParamsRef.current.categoryId) => {
        lastParamsRef.current = { page, categoryId }; // salvează mereu ultimii parametri
        setIsSyncing(true);
        try {
            const url = categoryId
                ? `${API_URL}/products?categoryId=${categoryId}&page=${page}`
                : `${API_URL}/products?page=${page}`;
            const res = await fetch(url);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
            setCurrentPage(page);
            // totalPages vine de la server dacă îl trimiți, altfel rămâne 1
            if (data.totalPages) setTotalPages(data.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            rejectUnauthorized: false // Îi spune browserului să accepte certificatul local mkcert
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setWsConnected(true);
            console.log("✅ Socket conectat!");
            fetchProducts();
        });

        socket.on('products:update', () => {
            console.log("🔄 Update de la server!");
            fetchProducts();
        });

        socket.on('disconnect', () => setWsConnected(false));
        return () => socket.disconnect();
    }, [fetchProducts]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchProducts(); 
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchProducts]);

    const addProduct = async (data) => {
        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (!res.ok) return { success: false, errors: [json.error || 'Eroare'] };
            fetchProducts();
            return { success: true };
        } catch (e) { return { success: false, errors: [e.message] }; }
    };

    const updateProduct = async (id, data) => {
        try {
            const res = await fetch(`${API_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (!res.ok) return { success: false, errors: [json.error || 'Eroare'] };
            fetchProducts();
            return { success: true };
        } catch (e) { return { success: false, errors: [e.message] }; }
    };

    const deleteProduct = async (id) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        try {
            await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
            return { success: true };
        } catch (err) {
            fetchProducts();
            return { success: false };
        }
    };

    const startFaker = async () => await fetch(`${API_URL}/faker/start`, { method: 'POST' });
    const stopFaker = async () => await fetch(`${API_URL}/faker/stop`, { method: 'POST' });

    return {
        products, wsConnected, isOnline, isSyncing,
        currentPage, totalPages, offlinePending: 0,
        fetchProducts, addProduct, updateProduct, deleteProduct,
        startFaker, stopFaker
    };
};