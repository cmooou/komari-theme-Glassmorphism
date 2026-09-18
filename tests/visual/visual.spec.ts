import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const STABLE_STYLE = `
  *, *::before, *::after {
    animation: none !important;
    caret-color: transparent !important;
    transition: none !important;
  }
  html { scroll-behavior: auto !important; }
  .earth-globe-host canvas,
  .earth-globe-canvas { opacity: 0 !important; }
`

async function openStablePage(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await page.addStyleTag({ content: STABLE_STYLE })
  await page.waitForTimeout(700)
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate(element => element.clientWidth))
}

async function expectNodeMetricIcons(page: Page): Promise<void> {
  for (const metric of ['cpu', 'memory', 'disk', 'traffic'])
    await expect(page.locator(`[data-node-metric-icon="${metric}"]`).first()).toBeVisible()
}

async function expectNodePingBars(page: Page): Promise<void> {
  const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  for (const metric of ['latency', 'loss']) {
    const bars = card.locator(`[data-node-ping-bars="${metric}"]`)
    await expect(bars).toBeVisible()
    await expect.poll(() => bars.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0)
  }
}

test('home light desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page)
  await openStablePage(page)
  await expectNodeMetricIcons(page)
  await expectNodePingBars(page)
  await expect(page).toHaveScreenshot('home-light-desktop.png', { fullPage: false })
})

test('home dark mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { dark: true })
  await openStablePage(page)
  await expectNodeMetricIcons(page)
  await expect(page).toHaveScreenshot('home-dark-mobile.png', { fullPage: false })
})

test('custom background keeps its initial viewport orientation until reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, {
    hideEarth: true,
    backgroundUrls: {
      light: 'https://visual.test/base.svg',
      lightLandscape: 'https://visual.test/landscape.svg',
      lightPortrait: 'https://visual.test/portrait-a.svg、https://visual.test/portrait-b.svg',
    },
  })
  await page.route('https://visual.test/*.svg', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0ea5e9"/></svg>',
  }))
  await openStablePage(page)

  const background = page.locator('.background-image')
  await expect(background).toBeVisible()
  const backgroundImage = () => background.evaluate(element => getComputedStyle(element).backgroundImage)
  await expect.poll(backgroundImage).toMatch(/portrait-[ab]\.svg/)

  await page.setViewportSize({ width: 1280, height: 720 })
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([1280, 720])
  await expect.poll(backgroundImage).toMatch(/portrait-[ab]\.svg/)

  await page.reload()
  await expect(background).toBeVisible()
  await expect.poll(backgroundImage).toContain('landscape.svg')
})

test('home accessible list desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { colorVisionFriendly: true, viewMode: 'list', hideEarth: true })
  await openStablePage(page)
  await expect(page).toHaveScreenshot('home-accessible-list-desktop.png', { fullPage: false })
})

test('home cobe layout desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { earthRenderer: 'cobe' })
  await openStablePage(page)
  await expectNodeMetricIcons(page)
  await expect(page).toHaveScreenshot('home-cobe-desktop.png', { fullPage: false })
})

test('home tiled layout desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { earthRenderer: 'tiled' })
  await openStablePage(page)
  await expectNodeMetricIcons(page)
  await expect(page).toHaveScreenshot('home-tiled-desktop.png', { fullPage: false })
})

test('home tiled layout respects custom general cards and order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    earthRenderer: 'tiled',
    generalCardKeys: ['currentTime', 'offlineNodes'],
  })
  await openStablePage(page)

  const cards = page.locator('[data-general-card-key]')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toHaveAttribute('data-general-card-key', 'currentTime')
  await expect(cards.nth(1)).toHaveAttribute('data-general-card-key', 'offlineNodes')
})

test('home mini card metric icons remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { nodeCardSize: 'mini', hideEarth: true })
  await openStablePage(page)

  const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  await expect(card.locator('[data-node-metric-icon="cpu"]')).toBeVisible()
  await expect(card.locator('[data-node-metric-icon="memory"]')).toBeVisible()
  await expect(card.locator('[data-node-metric-icon="traffic"]')).toBeVisible()
  await expect(card.getByRole('img', { name: 'CPU' })).toBeVisible()
  await expect(card.getByRole('img', { name: '内存' })).toBeVisible()
})

test('iOS standalone safe areas keep header and fixed controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { hideEarth: true })
  await openStablePage(page)
  await page.addStyleTag({
    content: `
      :root {
        --komari-safe-area-top: 59px;
        --komari-safe-area-right: 21px;
        --komari-safe-area-bottom: 34px;
        --komari-safe-area-left: 47px;
      }
    `,
  })

  const header = page.locator('[data-app-header]')
  const headerContent = page.locator('[data-app-header-content]')
  const visitorBar = page.locator('[data-visitor-compact-bar]')
  const backTop = page.locator('[data-back-top]')
  const footer = page.locator('[data-app-footer]')

  await expect(header).toHaveCSS('padding-top', '59px')
  await expect(headerContent).toHaveCSS('padding-left', '47px')
  await expect(headerContent).toHaveCSS('padding-right', '21px')
  await expect(visitorBar).toBeVisible()
  await expect(visitorBar).toHaveCSS('bottom', '46px')
  await expect(backTop).toHaveCSS('right', '33px')
  await expect(backTop).toHaveCSS('bottom', '98px')
  await expect(footer).toHaveCSS('padding-bottom', '50px')

  const settingsButton = page.getByRole('button', { name: '后台管理' })
  const settingsBox = await settingsButton.boundingBox()
  expect(settingsBox?.y).toBeGreaterThanOrEqual(59)
})

test('iOS page zoom enlarges safe-area padding so header stays below the inset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { hideEarth: true })
  await openStablePage(page)
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--komari-safe-area-zoom', '2')
  })
  await page.addStyleTag({
    content: `
      :root {
        --komari-safe-area-top: calc(59px * var(--komari-safe-area-zoom, 1));
        --komari-safe-area-right: calc(21px * var(--komari-safe-area-zoom, 1));
        --komari-safe-area-bottom: calc(34px * var(--komari-safe-area-zoom, 1));
        --komari-safe-area-left: calc(47px * var(--komari-safe-area-zoom, 1));
      }
    `,
  })

  const header = page.locator('[data-app-header]')
  const headerContent = page.locator('[data-app-header-content]')
  await expect(header).toHaveCSS('padding-top', '118px')
  await expect(headerContent).toHaveCSS('padding-left', '94px')
  await expect(headerContent).toHaveCSS('padding-right', '42px')

  const settingsButton = page.getByRole('button', { name: '后台管理' })
  const settingsBox = await settingsButton.boundingBox()
  expect(settingsBox?.y).toBeGreaterThanOrEqual(118)
})

test('iOS page zoom factor follows layout vs visual short side', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { hideEarth: true })
  await openStablePage(page)
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => 780 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 1688 })
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 780 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 1688 })
    Object.defineProperty(window.screen, 'width', { configurable: true, get: () => 390 })
    Object.defineProperty(window.screen, 'height', { configurable: true, get: () => 844 })
    if (window.visualViewport) {
      Object.defineProperty(window.visualViewport, 'width', { configurable: true, get: () => 390 })
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 844 })
      Object.defineProperty(window.visualViewport, 'scale', { configurable: true, get: () => 1 })
    }
    window.dispatchEvent(new Event('resize'))
  })
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--komari-safe-area-zoom').trim(),
  )).toBe('2')
})

test('three-net ping replaces summary bars with selected tasks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { hideEarth: true, threeNetPing: true })
  await openStablePage(page)

  const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  await expect(card.locator('[data-three-net-ping]')).toBeVisible()
  await expect(card.locator('[data-node-ping-bars="latency"]')).toHaveCount(0)
  await expect(card.locator('[data-node-ping-sparkline]')).toHaveCount(0)
  await expect(card.getByText('广东电信', { exact: true })).toBeVisible()
  await expect(card.getByText('广东移动', { exact: true })).toBeVisible()
  await expect(card.getByText('广东联通', { exact: true })).toBeVisible()

  for (const taskId of [1, 3, 4]) {
    for (const metric of ['latency', 'loss']) {
      const bars = card.locator(`[data-node-ping-bars="task-${taskId}-${metric}"]`)
      await expect(bars).toBeVisible()
      await expect.poll(() => bars.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0)
    }
  }

  const lossTooltips = card.locator('[data-node-ping-bars="task-1-loss"] [role="tooltip"]')
  await expect.poll(async () => {
    const texts = await lossTooltips.allTextContents()
    return texts.some((text) => {
      const match = text.match(/(\d+(?:\.\d+)?)%/)
      return Boolean(match && Number(match[1]) > 0)
    })
  }).toBeTruthy()
})

test('three-net ping sparkline style uses name latency line and loss', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { hideEarth: true, threeNetPing: true, threeNetPingSparkline: true })
  await openStablePage(page)

  const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  await expect(card.locator('[data-three-net-ping]')).toBeVisible()
  await expect(card.locator('[data-node-ping-sparkline="latency"]')).toHaveCount(0)
  await expect(card.locator('[data-node-ping-bars]')).toHaveCount(0)
  await expect(card.getByText('广东电信', { exact: true })).toBeVisible()
  await expect(card.getByText('广东移动', { exact: true })).toBeVisible()
  await expect(card.getByText('广东联通', { exact: true })).toBeVisible()

  for (const taskId of [1, 3, 4]) {
    const sparkline = card.locator(`[data-node-ping-sparkline="task-${taskId}"]`)
    await expect(sparkline).toBeVisible()
    await expect.poll(() => sparkline.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0)
    await expect(card.locator(`[data-node-ping-loss="task-${taskId}"]`)).toContainText('丢包')
  }

  await expect(card.locator('[data-node-ping-loss="task-1"]')).toContainText(/[1-9]/)
})

test('three-net sparkline loss values stay aligned on narrow cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { hideEarth: true, threeNetPing: true, threeNetPingSparkline: true })
  await openStablePage(page)

  const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  const rows = card.locator('.ping-sparkline-row')
  const lossLabels = card.locator('.ping-loss-label')
  const lossValues = card.locator('[data-node-ping-loss-value]')
  await expect(rows).toHaveCount(3)
  await expect(lossLabels).toHaveCount(3)
  await expect(lossValues).toHaveCount(3)

  const layout = await rows.first().evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      columns: style.gridTemplateColumns,
      width: element.getBoundingClientRect().width,
      right: element.getBoundingClientRect().right,
    }
  })
  expect(layout.columns.split(' ').length).toBe(5)
  expect(layout.width).toBeGreaterThan(0)

  const labelLefts = await lossLabels.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left))
  const valueRights = await lossValues.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().right))
  expect(Math.max(...labelLefts) - Math.min(...labelLefts)).toBeLessThanOrEqual(1)
  expect(Math.max(...valueRights) - Math.min(...valueRights)).toBeLessThanOrEqual(1)
  expect(valueRights.every(right => right <= layout.right + 1)).toBe(true)
})

test('node card expiry uses red through 5 days and yellow through 10 days', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { expiryThresholds: true, hideEarth: true })
  await openStablePage(page)

  const criticalCard = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
  const warningCard = page.getByRole('button', { name: '查看节点 香港边缘节点-超长名称布局测试 详情' })
  const criticalExpiry = criticalCard.getByText('剩余', { exact: true }).locator('..')
  const warningExpiry = warningCard.getByText('剩余', { exact: true }).locator('..')

  await expect(criticalExpiry).toContainText('剩余5天')
  await expect(criticalExpiry).toHaveClass(/text-destructive/)
  await expect(warningExpiry).toContainText('剩余10天')
  await expect(warningExpiry).toHaveClass(/text-warning/)
})

test('free node pricing stays semantic across home, finance, and detail', async ({ page }) => {
  const freeNodeName = '主控-洛杉矶'
  const freeNodeUuid = '00000000-0000-4000-8000-000000000001'
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { freePriceNode: true, hideEarth: true })
  await openStablePage(page)

  const nodeCard = page.getByRole('button', { name: `查看节点 ${freeNodeName} 详情` })
  await expect(nodeCard.getByText('免费', { exact: true })).toBeVisible()
  await expect(nodeCard.getByText('无', { exact: true })).toBeVisible()
  await expect(nodeCard.getByText('免费 / 年', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: '查看剩余价值明细' }).click()
  const financeDialog = page.getByRole('dialog', { name: '价值与费用明细' })
  await expect(financeDialog.getByText(freeNodeName, { exact: true })).toHaveCount(0)
  await financeDialog.getByLabel('排除免费节点').uncheck()
  const freeNodeRow = financeDialog.getByRole('cell', { name: freeNodeName, exact: true }).locator('..')
  await expect(freeNodeRow).toBeVisible()
  await expect(freeNodeRow.getByText('免费', { exact: true })).toBeVisible()
  await expect(freeNodeRow.getByText('无', { exact: true })).toBeVisible()

  await page.goto(`/instance/${freeNodeUuid}`)
  await expect(page.getByText('硬件信息', { exact: true })).toBeVisible()
  await expect(page.getByText('节点价格', { exact: true })).toBeVisible()
  await expect(page.getByText('剩余价值', { exact: true })).toBeVisible()
  await expect(page.getByText('无', { exact: true })).toBeVisible()
  await expect(page.getByText('免费 / 月', { exact: true })).toHaveCount(0)
})

test('detail light desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page)
  await openStablePage(page, '/instance/00000000-0000-4000-8000-000000000001')
  await expect(page.getByText('硬件信息')).toBeVisible()
  await expect(page).toHaveScreenshot('detail-light-desktop.png', { fullPage: false })
})

test('detail dark mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { dark: true })
  await openStablePage(page, '/instance/00000000-0000-4000-8000-000000000002')
  await expect(page.getByText('硬件信息')).toBeVisible()
  await expect(page).toHaveScreenshot('detail-dark-mobile.png', { fullPage: false })
})

test('detail short history falls back when metric history omits CPU', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { missingCpuMetricHistory: true })
  await openStablePage(page, '/instance/00000000-0000-4000-8000-000000000001')

  const cpuValue = page.locator('[data-load-chart-card="cpu"] [data-latest-cpu]')
  const loadRange = page.locator('[data-load-chart-range]')
  for (const view of ['4 小时', '1 天']) {
    await loadRange.getByRole('tab', { name: view, exact: true }).click()
    await expect(cpuValue).toHaveText(/^\d+\.\d$/)
  }
})

test('detail history keeps cumulative traffic counters on their last value', async ({ page }) => {
  const historyCalls: Array<Record<string, unknown>> = []

  page.on('request', (request) => {
    if (!request.url().endsWith('/api/rpc2'))
      return

    const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> } | null
    const metricKeys = Array.isArray(payload?.params?.metric_keys) ? payload.params.metric_keys : []
    if (payload?.method === 'public:queryMetrics' && metricKeys.includes('net.total.up'))
      historyCalls.push(payload.params ?? {})
  })

  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page)
  await openStablePage(page, '/instance/00000000-0000-4000-8000-000000000001')

  await page.locator('[data-load-chart-range]').getByRole('tab', { name: '1 天', exact: true }).click()
  await expect.poll(() => historyCalls.length).toBeGreaterThan(0)

  expect(historyCalls.at(-1)).toMatchObject({
    aggregation: 'avg',
    aggregation_by_metric: {
      'net.total.up': 'last',
      'net.total.down': 'last',
    },
  })
})

test('detail ping requests stay scoped to the current node', async ({ page }) => {
  const currentUuid = '00000000-0000-4000-8000-000000000001'
  const metricCalls: Array<{ method: string, params: Record<string, unknown> }> = []
  const isPingMetricCall = (call: { method: string, params: Record<string, unknown> }): boolean => {
    const metricKeys = Array.isArray(call.params.metric_keys) ? call.params.metric_keys : []
    return call.method === 'public:getPingMetricStats'
      || metricKeys.includes('ping.latency_ms')
      || metricKeys.includes('ping.loss')
  }

  page.on('request', (request) => {
    if (!request.url().endsWith('/api/rpc2'))
      return

    const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> } | null
    if (payload?.method === 'public:queryMetrics' || payload?.method === 'public:getPingMetricStats') {
      metricCalls.push({ method: payload.method, params: payload.params ?? {} })
    }
  })

  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page)
  await openStablePage(page)

  await expect.poll(() => metricCalls.filter(isPingMetricCall).length).toBeGreaterThan(0)
  const homeSummaryCalls = metricCalls.filter(call => call.method === 'public:queryMetrics' && isPingMetricCall(call))
  expect(homeSummaryCalls.length).toBeGreaterThan(0)
  expect(homeSummaryCalls.every(call => call.params.max_points === 150)).toBe(true)

  metricCalls.length = 0
  await page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' }).click()
  await expect(page).toHaveURL(`/instance/${currentUuid}`)
  await expect(page.getByText('硬件信息')).toBeVisible()
  await page.waitForTimeout(2_000)

  const detailPingCalls = metricCalls.filter(isPingMetricCall)
  expect(detailPingCalls.length).toBeGreaterThan(0)
  expect(new Set(detailPingCalls.map(call => call.params.entity_id))).toEqual(new Set([currentUuid]))
})

test('detail ping tasks follow the backend task order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { pingTaskOrdering: true })
  await openStablePage(page, '/instance/00000000-0000-4000-8000-000000000001')

  const taskCards = page.locator('[data-ping-task-id]')
  await expect(taskCards).toHaveCount(3)
  await expect(taskCards.first()).toHaveAttribute('data-ping-task-id', '30')
  await expect(taskCards.nth(1)).toHaveAttribute('data-ping-task-id', '10')
  await expect(taskCards.nth(2)).toHaveAttribute('data-ping-task-id', '20')
  await expect(taskCards).toContainText(['浙江移动', '浙江联通', '浙江电信'])
})
