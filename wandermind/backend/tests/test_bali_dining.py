import unittest
from fastapi import HTTPException
from main import _bali_food, _normalise_trip_profile, _professional_route_document, _public_professional_route


class BaliDiningTests(unittest.TestCase):
    def test_day_and_geography_and_preview(self):
        restaurant = next(item for item in _bali_food()['restaurants'] if item.get('published') and item['region'] == 'G1' and 'lunch' in item['suitableDayparts'])
        profile = _normalise_trip_profile({'days': 7, 'dining_stops': [{'day': 1, 'restaurant_id': restaurant['id'], 'meal': 'lunch'}]})
        document = _professional_route_document(profile, 'R1', 'zh')
        self.assertEqual(document['full_days'][0]['restaurants'][0]['id'], restaurant['id'])
        public = _public_professional_route(document, False, 'zh')
        self.assertEqual((public['preview_days'], public['locked_days']), (5, 2))
        self.assertNotIn('restaurants', public['days_plan'][-1])
        profile['dining_stops'][0]['day'] = 4
        with self.assertRaises(HTTPException):
            _professional_route_document(profile, 'R1', 'en')

    def test_trust_boundary(self):
        for stops in ['bad', [{'day': True, 'restaurant_id': 'invented', 'meal': 'lunch'}], [{'day': 1, 'restaurant_id': 'invented', 'meal': 'lunch'}]]:
            with self.subTest(stops=stops), self.assertRaises(HTTPException):
                _normalise_trip_profile({'days': 7, 'dining_stops': stops})
        with self.assertRaises(HTTPException):
            _normalise_trip_profile({'extension_ids': ['invented']})

    def test_island_stops_require_island_day(self):
        restaurant = next(item for item in _bali_food()['restaurants'] if item.get('published') and item['node_id'].startswith('nusa_penida'))
        stop = {'day': 7, 'restaurant_id': restaurant['id'], 'meal': 'lunch'}
        profile = _normalise_trip_profile({'days': 7, 'extension_ids': ['penida-west'], 'dining_stops': [stop]})
        document = _professional_route_document(profile, 'R1', 'en')
        self.assertEqual(document['full_days'][-1]['departure_port'], 'Sanur')
        self.assertEqual(document['full_days'][-1]['restaurants'][0]['id'], restaurant['id'])
        profile['extension_ids'] = []
        with self.assertRaises(HTTPException):
            _professional_route_document(profile, 'R1', 'en')


if __name__ == '__main__':
    unittest.main()
