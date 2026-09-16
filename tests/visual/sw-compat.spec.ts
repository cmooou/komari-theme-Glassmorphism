import { expect, test } from '@playwright/test'

test('compatibility worker redirects bare admin route without legacy caches', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await page.goto('/admin', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await expect.poll(async () => page.evaluate(async () =>
    (await caches.keys()).filter(name => /workbox|precache|komari/i.test(name)),
  )).toEqual([])
})
