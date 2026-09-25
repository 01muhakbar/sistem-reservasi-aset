const fetch = require('node-fetch');

async function test() {
  // Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@mahasiswa.com', password: 'password' })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }
  
  const token = loginRes.headers.get('set-cookie'); // if using cookies
  // Wait, let's just get the token from json if they use JWT in response
  const loginData = await loginRes.json();
  const jwt = loginData.token || ''; // maybe? Let's check headers

  const cookie = loginRes.headers.raw()['set-cookie'] ? loginRes.headers.raw()['set-cookie'][0] : '';
  
  // Book
  const payload = {
    event_name: 'Workshop Nasional 2026',
    main_event_venue_id: '2b26946d-2e41-4095-a3bd-10a7b4edbf80',
    main_event_start: new Date('2026-09-26T00:01:00').toISOString(),
    main_event_end: new Date('2026-09-26T23:59:00').toISOString(),
    rehearsal_venue_id: '',
    rehearsal_start: '',
    rehearsal_end: '',
    actual_event_start: '08:00',
    actual_event_end: '17:00',
    vendors: []
  };

  console.log('Sending payload:', payload);

  const res = await fetch('http://localhost:5000/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify(payload)
  });

  console.log('Status:', res.status);
  console.log('Response:', await res.text());
}

test().catch(console.error);
