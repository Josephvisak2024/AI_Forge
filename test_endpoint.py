import asyncio
import json
from httpx import AsyncClient

async def test():
    async with AsyncClient(base_url='http://localhost:8000') as client:
        # Step 1: Register/login
        signup_res = await client.post('/api/auth/login', json={
            'email': 'test@amzur.com',
            'password': 'testpass123'
        })
        print(f'Signup status: {signup_res.status_code}')
        if signup_res.status_code != 200:
            print(f'Error: {signup_res.text}')
            return
        
        # Extract token from cookies
        auth_token = signup_res.cookies.get('access_token')
        if not auth_token:
            print(f'Error: No token in cookies')
            return
        
        print(f'Token: {auth_token[:20]}...')
        
        # Step 2: Create a thread
        thread_res = await client.post(
            '/api/threads',
            json={'title': 'Test Image Generation'},
            cookies={'access_token': auth_token}
        )
        print(f'Thread create status: {thread_res.status_code}')
        if thread_res.status_code != 200:
            print(f'Error: {thread_res.text}')
            return
        
        thread_data = thread_res.json()
        thread_id = thread_data['id']
        print(f'Thread: {thread_id}')
        
        # Step 3: Try generate-image
        gen_res = await client.post(
            '/api/generate-image',
            json={'prompt': 'test prompt for image', 'thread_id': thread_id},
            cookies={'access_token': auth_token}
        )
        print(f'\nGenerate-image Status: {gen_res.status_code}')
        print(f'Response: {gen_res.text}')

asyncio.run(test())
