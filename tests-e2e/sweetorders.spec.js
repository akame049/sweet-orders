import { test, expect } from '@playwright/test';

test.describe('SweetOrders E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/');
        await page.click('text=Products');
        await page.waitForSelector('.product-table');
    });

    test('utilizatorul poate adăuga un produs nou', async ({ page }) => {
        await page.fill('input[name="pName"]', 'New Test Cake');
        await page.fill('input[name="pPrice"]', '25');
        await page.fill('input[name="pCategory"]', 'Cakes');
        await page.locator('[name="pDesc"]').fill('O descriere de test valida');

        await page.click('button.btn-add');

        
        await expect(page.locator('table')).toContainText('New Test Cake', { timeout: 10000 });
    });

    test('utilizatorul poate vedea detaliile unui produs', async ({ page }) => {
        await page.locator('button:has-text("Detalii")').first().click();

        const detailsPanel = page.locator('h3:has-text("Detalii Produs")');
        await expect(detailsPanel).toBeVisible();
        await expect(page.locator('.detail-panel')).toContainText('$45.00');
    });

    test('utilizatorul poate șterge un produs', async ({ page }) => {
        const firstName = await page.locator('tbody tr:first-child td:nth-child(2)').innerText();

        page.on('dialog', dialog => dialog.accept());
        await page.locator('.btn-del').first().click();

        await expect(page.locator('table')).not.toContainText(firstName, { timeout: 5000 });
    });
});