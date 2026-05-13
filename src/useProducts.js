import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const API_URL = 'https://sweet-orders-u2ai.onrender.com/api';
const SOCKET_URL = 'https://sweet-orders-u2ai.onrender.com';

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [wsConnected, setWsConnected] = useState(false);
    const socketRef = useRef(null);

    const fetchProducts = useCallback(async (page = 1, categoryId = '') => {
        try {
            // Trimitem categoryId către server!
            const url = categoryId
                ? `${API_URL}/products?categoryId=${categoryId}`
                : `${API_URL}/products`;

            const res = await fetch(url);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    }, []);

    // Conexiune Socket
    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setWsConnected(true);
            console.log("✅ Socket conectat!");
        });

        // ACESTA ESTE MOMENTUL LIVE
        socket.on('products:update', () => {
            console.log("🔄 Update de la server! Reîmprospătez...");
            fetchProducts();
        });

        socket.on('disconnect', () => setWsConnected(false));

        return () => socket.disconnect();
    }, [fetchProducts]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const deleteProduct = async (id) => {
        // Ștergere vizuală instantă (optimistic)
        setProducts(prev => prev.filter(p => p.id !== id));
        try {
            await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
            // Nu mai e nevoie de fetch aici, o va face socket-ul automat
        } catch (err) {
            fetchProducts(); // Dacă e eroare, readucem produsele
        }
    };

    const startFaker = async () => {
        await fetch(`${API_URL}/faker/start`, { method: 'POST' });
    };

    const stopFaker = async () => {
        await fetch(`${API_URL}/faker/stop`, { method: 'POST' });
    };

    return {
        products,
        wsConnected,
        fetchProducts,
        deleteProduct,
        startFaker,
        stopFaker
    };
};