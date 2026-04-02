const PLATFORMS = [
  {
    code: 'linkedin',
    name: 'LinkedIn',
    domains: ['www.linkedin.com'],
    cookieNames: ['li_at', 'JSESSIONID'],
  },
  {
    code: 'zhaopin',
    name: '智联招聘',
    domains: ['www.zhaopin.com', 'i.zhaopin.com'],
    cookieNames: null,
  },
  {
    code: 'lagou',
    name: '拉勾',
    domains: ['www.lagou.com'],
    cookieNames: null,
  },
  {
    code: 'boss_zhipin',
    name: 'Boss直聘',
    domains: ['www.zhipin.com'],
    cookieNames: ['__zp_stoken__', 'wt2'],
  },
  {
    code: 'liepin',
    name: '猎聘',
    domains: ['www.liepin.com'],
    cookieNames: null,
  },
];

// Load saved settings
chrome.storage.local.get(['backendUrl', 'authToken'], (result) => {
  document.getElementById('backendUrl').value = result.backendUrl || 'http://127.0.0.1:54321';
  document.getElementById('authToken').value = result.authToken || '';
});

document.getElementById('backendUrl').addEventListener('change', (e) => {
  chrome.storage.local.set({ backendUrl: e.target.value });
});
document.getElementById('authToken').addEventListener('change', (e) => {
  chrome.storage.local.set({ authToken: e.target.value });
});

// Render platform list using safe DOM methods
const container = document.getElementById('platforms');

PLATFORMS.forEach((platform) => {
  const div = document.createElement('div');
  div.className = 'platform';

  const infoDiv = document.createElement('div');

  const nameDiv = document.createElement('div');
  nameDiv.className = 'platform-name';
  nameDiv.textContent = platform.name;
  infoDiv.appendChild(nameDiv);

  const statusDiv = document.createElement('div');
  statusDiv.className = 'platform-status';
  statusDiv.id = `status-${platform.code}`;
  statusDiv.textContent = 'Ready to export';
  infoDiv.appendChild(statusDiv);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.id = `btn-${platform.code}`;
  btn.textContent = 'Export';
  btn.addEventListener('click', () => exportCookies(platform));

  div.appendChild(infoDiv);
  div.appendChild(btn);
  container.appendChild(div);
});

async function exportCookies(platform) {
  const btn = document.getElementById(`btn-${platform.code}`);
  const status = document.getElementById(`status-${platform.code}`);
  const statusBar = document.getElementById('status');

  btn.disabled = true;
  btn.textContent = 'Exporting...';
  status.textContent = 'Extracting cookies...';

  try {
    const allCookies = [];
    for (const domain of platform.domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      if (platform.cookieNames) {
        allCookies.push(...cookies.filter((c) => platform.cookieNames.includes(c.name)));
      } else {
        allCookies.push(...cookies);
      }
    }

    if (allCookies.length === 0) {
      status.textContent = 'No cookies found — log in first';
      btn.textContent = 'Export';
      btn.disabled = false;
      return;
    }

    const sessionToken = JSON.stringify(
      allCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        expirationDate: c.expirationDate,
      }))
    );

    const backendUrl = document.getElementById('backendUrl').value;
    const authToken = document.getElementById('authToken').value;

    if (!authToken) {
      status.textContent = 'Set auth token in settings';
      btn.textContent = 'Export';
      btn.disabled = false;
      return;
    }

    const res = await fetch(`${backendUrl}/functions/v1/platform-connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        platform_code: platform.code,
        session_token: sessionToken,
        consent_scope: 'apply_and_message',
      }),
    });

    const json = await res.json();

    if (res.ok) {
      status.textContent = `Connected (${allCookies.length} cookies)`;
      btn.textContent = 'Done';
      btn.className = 'btn btn-success';
      statusBar.textContent = `${platform.name} connected successfully`;
      statusBar.className = 'status-bar show success';
    } else {
      status.textContent = json.error?.message || 'Failed';
      btn.textContent = 'Retry';
      btn.disabled = false;
      statusBar.textContent = json.error?.message || 'Connection failed';
      statusBar.className = 'status-bar show error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    btn.textContent = 'Retry';
    btn.disabled = false;
    statusBar.textContent = `Error: ${e.message}`;
    statusBar.className = 'status-bar show error';
  }
}
