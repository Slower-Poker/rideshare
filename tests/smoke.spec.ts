import { test, expect } from '@playwright/test';

test.describe('RideShare.Click Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check for main heading
    await expect(page.getByText('Community Ride Sharing')).toBeVisible();
    
    // Check for key elements
    await expect(page.getByText('RideShare.Click')).toBeVisible();
    await expect(page.getByRole('button', { name: /Map/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Account/i })).toBeVisible();
  });

  test('navigation to map view works', async ({ page }) => {
    await page.goto('/');
    
    // Click map button
    await page.getByRole('button', { name: /Map/i }).click();
    
    // Verify map view loaded
    await expect(page.getByText('Available Rides')).toBeVisible();
  });

  test('navigation to account view works', async ({ page }) => {
    await page.goto('/');
    
    // Click account button
    await page.getByRole('button', { name: /Account/i }).click();
    
    // Verify account view loaded
    await expect(page.getByText('My Account')).toBeVisible();
  });

  test('terms page is accessible', async ({ page }) => {
    await page.goto('/');
    
    // Click terms link in footer
    await page.getByRole('button', { name: /Terms of Service/i }).click();
    
    // Verify terms page loaded
    await expect(page.getByText('RideShare.Click Terms of Service')).toBeVisible();
  });

  test('responsive design on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that page renders on mobile
    await expect(page.getByText('RideShare.Click')).toBeVisible();
  });
});
