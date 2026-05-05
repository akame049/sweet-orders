import { useState } from 'react';
import { useCookies } from 'react-cookie';

export const useOrders = () => {
    const [orders, setOrders] = useState([]);

    const [cookies, setCookie] = useCookies(['lastAction']);

    const addOrder = (order) => {
       
        if (!order.customer || order.price <= 0) return alert("Date invalide!");

        const newOrder = { ...order, id: Date.now() };
        setOrders([...orders, newOrder]);

       
        setCookie('lastAction', `Adaugat: ${order.product}`, { path: '/' });
    };

    const deleteOrder = (id) => {
        setOrders(orders.filter(o => o.id !== id));
        setCookie('lastAction', `Sters comanda ${id}`, { path: '/' });
    };

    return { orders, addOrder, deleteOrder, lastAction: cookies.lastAction };
};