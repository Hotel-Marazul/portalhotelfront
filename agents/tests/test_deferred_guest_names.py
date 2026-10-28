import unittest

from pydantic import ValidationError
from schemas.booking import ReservationGuestInput
from schemas.messages import AdditionalGuest


class DeferredGuestNamesTests(unittest.TestCase):
    def test_both_contracts_allow_missing_names_and_keep_age(self):
        for model in (ReservationGuestInput, AdditionalGuest):
            self.assertEqual(model(age=11).name, "")
            self.assertEqual(model(name="  ", age=11).name, "")
            self.assertEqual(model(name=" Ana ", age=11).name, "Ana")
            for data in ({"name": "A", "age": 11}, {"age": -1}, {"name": "Ana"}):
                with self.assertRaises(ValidationError):
                    model(**data)
