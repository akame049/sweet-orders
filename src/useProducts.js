import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client'; 

const API_URL = 'https://sweet-orders-u2ai.onrender.com/api';
const SOCKET_URL = 'https://sweet-orders-u2ai.onrender.com';

let offlineQueue = [];

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const socketRef = useRef(null); 
    const ITEMS_PER_PAGE = 6;

    const [currentCategory, setCurrentCategory] = useState('');

    const fetchProducts = useCallback(async (page = 1, categoryId = '') => {
        if (!navigator.onLine) return;
        try {
            const categoryParam = categoryId ? `&categoryId=${categoryId}` : '';

            const res = await fetch(`${API_URL}/products?page=${page}&limit=${ITEMS_PER_PAGE}${categoryParam}`);

            if (!res.ok) throw new Error('Server error');

            const data = await res.json();

            setProducts(Array.isArray(data) ? data : []);
            setTotal(data.length || 0);
            setCurrentPage(page);
            setCurrentCategory(categoryId);
            setTotalPages(1);

        } catch (err) {
            console.warn('Fetch eșuat — mod offline activat');
            setIsOnline(false);
        }
    }, []);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            syncOfflineQueue();
        };
        const goOffline = () => setIsOnline(false);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        fetchProducts(1);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, [fetchProducts]);

    useEffect(() => {
        const socket = io(SOCKET_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            setWsConnected(true);
            console.log("Connected to Socket.io Server");
        });

        socket.on('disconnect', () => {
            setWsConnected(false);
        });

        socket.on('FAKER_BATCH', (newProducts) => {
            console.log("Batch primit:", newProducts);
            setProducts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const existingNames = new Set(prev.map(p => p.name));
                const uniqueNew = newProducts.filter(p =>
                    !existingIds.has(p.id) && !existingNames.has(p.name)
                );
                if (uniqueNew.length === 0) return prev;
                return [...prev, ...uniqueNew]; 
            });
            setTotal(prev => prev + newProducts.length);
        });

        socket.on('PRODUCT_ADDED', (newProduct) => {
            setProducts(prev => {
                if (prev.find(p => p.id === newProduct.id || p.name === newProduct.name)) {
                    return prev;
                }
                return [...prev, newProduct];
            });
        });

        socket.on('PRODUCT_DELETED', (id) => {
            setProducts(prev => prev.filter(p => p.id != id));
            setTotal(prev => prev - 1);
        });

        socket.on('PRODUCT_UPDATED', (updatedProduct) => {
            setProducts(prev => prev.map(p => p.id == updatedProduct.id ? updatedProduct : p));
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const syncOfflineQueue = async () => {
        if (offlineQueue.length === 0) return;
        setIsSyncing(true);
        const queue = [...offlineQueue];
        offlineQueue = [];

        for (const op of queue) {
            try {
                await fetch(op.url, op.options);
            } catch {
                offlineQueue.push(op);
            }
        }
        setIsSyncing(false);
        fetchProducts(currentPage, currentCategory);
    };

    const addProduct = async (productData) => {
        const formattedData = {
            ...productData,
            categoryId: parseInt(productData.categoryId) || 1,
            image: productData.image || `https://loremflickr.com/150/150/bakery?lock=${Date.now()}`
        };

        const optimisticProduct = { ...formattedData, id: Date.now(), _offline: true };

        if (!navigator.onLine) {
            setProducts(prev => [...prev, optimisticProduct]);
            offlineQueue.push({
                url: `${API_URL}/products`,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formattedData), 
                }
            });
            return { success: true, offline: true };
        }

        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formattedData), 
            });

            const data = await res.json();
            if (!res.ok) return { success: false, errors: data.errors };

            fetchProducts(currentPage);
            return { success: true };
        } catch (err) {
            return { success: false, errors: ['Network error'] };
        }
    };

   

    const updateProduct = async (id, productData) => {
        const cleanId = String(id).split(':')[0];

        try {
            const res = await fetch(`${API_URL}/products/${cleanId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });

            if (!res.ok) throw new Error('Eroare la salvare');

            await fetchProducts(currentPage);
            return { success: true };
        } catch (err) {
            return { success: false, errors: [err.message] };
        }
    };

    const deleteProduct = async (id) => {
        setProducts(prev => prev.filter(p => p.id !== id));

        if (!navigator.onLine) {
            offlineQueue.push({
                url: `${API_URL}/products/${id}`,
                options: { method: 'DELETE' }
            });
            return { success: true, offline: true };
        }

        try {
            const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                fetchProducts(currentPage);
                return { success: false };
            }
            return { success: true };
        } catch (err) {
            return { success: false };
        }
    };

    const startFaker = async () => {
        const res = await fetch(`${API_URL}/faker/start`, { method: 'POST' });
        const data = await res.json();
        console.log(data.message);
    };

    const stopFaker = async () => {
        const res = await fetch(`${API_URL}/faker/stop`, { method: 'POST' });
        const data = await res.json();
        console.log(data.message);
    };

    return {
        products,
        total,
        totalPages,
        currentPage,
        isOnline,
        isSyncing,
        wsConnected,
        offlinePending: offlineQueue.length,
        fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        startFaker,
        stopFaker,
        ITEMS_PER_PAGE,
    };
};