import unittest
from tesla_tw.domain.registrations import normalize_period, parse_count, parse_market_csv, parse_brand_csv, analyze

class RegistrationTests(unittest.TestCase):
    def test_roc_months_are_normalized(self):
        for value in ('115年8月', '11508', '2026-08', '2026/8'):
            self.assertEqual(normalize_period(value), '2026-08')
        for value in ('115年13月', '115年'):
            with self.assertRaises(ValueError): normalize_period(value)

    def test_missing_is_never_zero(self):
        for value in ('', '-', '…', 'NA'):
            self.assertIsNone(parse_count(value))
        self.assertEqual(parse_count('1,234'), 1234)
        self.assertEqual(parse_count('0'), 0)
        for value in ('-1', '1.5', 'NaN'):
            with self.assertRaises(ValueError): parse_count(value)

    def test_market_keeps_only_monthly_passenger_car_totals(self):
        rows = parse_market_csv('統計期,汽車,小客車\n115年,500,400\n115年8月,100,90\n')
        self.assertEqual(rows, [{'period': '2026-08', 'count': 90}])

    def test_brand_rows_are_not_double_counted(self):
        rows = parse_brand_csv('統計期,廠牌,小客車\n115年8月,TESLA,100\n115年8月,TOYOTA,200\n')
        self.assertEqual(rows, [{'period': '2026-08', 'count': 100}])
        with self.assertRaises(ValueError):
            parse_brand_csv('統計期,廠牌,小客車\n115年8月,TESLA,100\n115年8月,特斯拉,100\n')
        with self.assertRaises(ValueError): parse_brand_csv('統計期,汽車\n115年8月,100\n')

    def test_share_uses_same_period_and_scope(self):
        result = analyze([{'period':'2026-08','count':100}], [{'period':'2026-08','count':1000}])
        self.assertEqual(result[0]['share'], 10)
        self.assertIsNone(result[0]['mom'])
        self.assertIsNone(analyze([{'period':'2026-08','count':100}], [])[0]['share'])
        with self.assertRaises(ValueError): analyze([{'period':'2026-08','count':100}], [{'period':'2026-08','count':50}])

    def test_growth_requires_previous_calendar_month(self):
        result = analyze([{'period':'2026-06','count':50},{'period':'2026-08','count':100}], [])
        self.assertIsNone(result[-1]['mom'])
        result = analyze([{'period':'2026-07','count':50},{'period':'2026-08','count':100}], [])
        self.assertEqual(result[-1]['mom'], 100)
        result = analyze([{'period':'2026-07','count':0},{'period':'2026-08','count':100}], [])
        self.assertIsNone(result[-1]['mom'])

if __name__ == '__main__': unittest.main()
