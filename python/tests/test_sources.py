import unittest
from tesla_tw.infrastructure.sources import validate_official_url, discover_csv, normalize_stations, parse_feed
from tesla_tw.application.refresh import merge_section

class SourceTests(unittest.TestCase):
    def test_current_tdx_openapi_wrapper_and_nested_address(self):
        payload={'UpdateTime':'2026-10-09T08:00:00+08:00','Stations':[{'StationName':{'Zh_tw':'公有站'},'OperatorID':'OP','PositionLat':24.1,'PositionLon':120.6,'Location':{'Address':{'City':'臺中市','Town':'中區','Road':'測試路','No':'1號'}}}]}
        rows=normalize_stations(payload)
        self.assertEqual(rows[0]['city'],'臺中市')
        self.assertEqual(rows[0]['address'],'臺中市中區測試路1號')
        self.assertEqual(rows[0]['updatedAt'],payload['UpdateTime'])
        self.assertTrue(rows[0]['id'])

    def test_only_official_https_hosts_are_accepted(self):
        self.assertEqual(validate_official_url('https://stat.thb.gov.tw/export.csv'), 'https://stat.thb.gov.tw/export.csv')
        for url in ('http://stat.thb.gov.tw/x', 'https://thb.gov.tw.evil.com/x', 'https://127.0.0.1/x','https://user@www.thb.gov.tw/x'):
            with self.assertRaises(ValueError): validate_official_url(url)

    def test_discover_resource_requires_csv_and_official_domain(self):
        html = '<a href="https://www.thb.gov.tw/a.csv">CSV</a><a href="https://evil.com/b.csv">CSV</a>'
        self.assertEqual(discover_csv(html), 'https://www.thb.gov.tw/a.csv')
        with self.assertRaises(ValueError): discover_csv('<html>blocked</html>')

    def test_tdx_duplicates_removed_without_claiming_tesla_compatibility(self):
        rows = normalize_stations([{'StationUID':'A','StationName':{'Zh_tw':'測試站'},'Town':'中區','City':'Taichung','Address':'測試路'}, {'StationUID':'A','StationName':{'Zh_tw':'測試站'}}])
        self.assertEqual(len(rows),1)
        self.assertNotIn('teslaCompatible', rows[0])
        with self.assertRaises(ValueError): normalize_stations({'error':'no token'})

    def test_feed_filters_and_retains_published_time(self):
        xml = '<rss><channel><item><title>特斯拉召回公告</title><link>https://www.thb.gov.tw/news/1</link><pubDate>Wed, 07 Oct 2026 00:00:00 GMT</pubDate></item><item><title>道路施工</title><link>https://www.thb.gov.tw/news/2</link></item></channel></rss>'
        rows = parse_feed(xml)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['publishedAt'],'2026-10-07T00:00:00+00:00')
        self.assertEqual(rows[0]['category'],'Tesla')

    def test_failure_preserves_last_success_and_marks_stale(self):
        old={'status':'ok','fetchedAt':'2026-10-01T00:00:00Z','rows':[{'count':10}]}
        result=merge_section(old, None, '2026-10-09T00:00:00Z', '來源暫時無法連線')
        self.assertEqual(result['rows'],old['rows'])
        self.assertEqual(result['fetchedAt'],old['fetchedAt'])
        self.assertEqual(result['status'],'stale')
        self.assertEqual(result['attemptedAt'],'2026-10-09T00:00:00Z')

if __name__ == '__main__': unittest.main()
