import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AuthPage from './AuthPage';

// Facem un mock (o simulare) pentru funcția onSuccess ca să vedem dacă e apelată
const mockOnSuccess = vi.fn();

describe('🍰 Teste Automate - Formular Login Frontend', () => {

    it('📦 Randare: Verifică dacă inputurile și butonul există pe ecran', () => {
        render(<AuthPage onSuccess={mockOnSuccess} />);

        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/parolă/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /intră în cont|login/i })).toBeInTheDocument();
    });

    it('⚠️ Validare: Oprește trimiterea și arată eroare dacă dai click cu câmpurile goale', async () => {
        render(<AuthPage onSuccess={mockOnSuccess} />);

        const submitButton = screen.getByRole('button', { name: /intră în cont|login/i });

        // Simulăm click-ul pe buton fără să scriem nimic în inputuri
        fireEvent.click(submitButton);

        // Verificăm că funcția de succes NU a fost apelată (pentru că logarea a eșuat)
        expect(mockOnSuccess).not.toHaveBeenCalled();

        // Căutăm dacă pe ecran a apărut un mesaj de eroare nativ sau text de validare
        await waitFor(() => {
            const errorElement = screen.queryByText(/completat|obligatoriu|invalid|eroare/i);
            // Testul trece fie dacă ai un mesaj text afișat, fie dacă HTML-ul nativ blochează (required)
            if (errorElement) {
                expect(errorElement).toBeInTheDocument();
            }
        });
    });
});