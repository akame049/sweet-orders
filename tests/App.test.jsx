import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../src/App';
import { CookiesProvider } from 'react-cookie';

vi.mock('../src/useProducts', () => ({
    useProducts: () => ({
        products: [
            { id: 1, name: 'Chocolate Dream Cake', category: 'Cakes', price: 45.00, description: 'Un tort bogat.', image: '' },
            { id: 2, name: 'Butter Croissants', category: 'Pastries', price: 4.50, description: 'Croissante fragede.', image: '' },
            { id: 3, name: 'Fruit Tart', category: 'Cakes', price: 28.00, description: 'O tartă crocantă.', image: '' },
        ],
        total: 3,
        totalPages: 1,
        currentPage: 1,
        isOnline: true,
        isSyncing: false,
        wsConnected: true,
        offlinePending: 0,
        fetchProducts: vi.fn(),
        addProduct: vi.fn().mockResolvedValue({ success: true }),
        updateProduct: vi.fn().mockResolvedValue({ success: true }),
        deleteProduct: vi.fn().mockResolvedValue({ success: true }),
        startFaker: vi.fn(),
        stopFaker: vi.fn(),
        ITEMS_PER_PAGE: 5,
    })
}));

window.alert = vi.fn();
window.confirm = vi.fn(() => true);

const renderApp = () => render(
    <CookiesProvider>
        <App />
    </CookiesProvider>
);

describe('CRUD Operations Unit Tests', () => {

    it('ar trebui să randeze produsele inițiale (Read)', async () => {
        renderApp();
        fireEvent.click(screen.getByText(/Products/i));

        expect(await screen.findByText(/Chocolate Dream Cake/i)).toBeInTheDocument();
        expect(screen.getByText(/Butter Croissants/i)).toBeInTheDocument();
    });

    it('ar trebui să adauge un produs nou (Create)', async () => {
        renderApp();
        fireEvent.click(screen.getByText(/Products/i));

        fireEvent.change(screen.getByPlaceholderText(/Nume/i), { target: { value: 'Test Cake' } });
        fireEvent.change(screen.getByPlaceholderText(/Preț/i), { target: { value: '10' } });

        const categorySelect = document.querySelector('select[name="pCategory"]');
        fireEvent.change(categorySelect, { target: { value: '1' } });

        fireEvent.change(screen.getByPlaceholderText(/Descriere/i), { target: { value: 'Delicious test cake' } });

        fireEvent.click(screen.getByText('Adaugă'));

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Nume/i).value).toBe('');
        });
    });

    it('ar trebui să șteargă un produs (Delete)', async () => {
        renderApp();
        fireEvent.click(screen.getByText(/Products/i));

        const deleteButtons = await screen.findAllByText(/🗑️/);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalled();
        });
    });
});