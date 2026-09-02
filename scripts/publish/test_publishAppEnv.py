#!/usr/bin/env python3
"""Unit tests for the publish appEnv stamp (no VM, no pack)."""

import json
import unittest

from publishMlsBase import resolve_publish_app_env, stamped_project_json


class ResolvePublishAppEnvTest(unittest.TestCase):
    def test_local_default_is_presentation(self):
        mode, reason = resolve_publish_app_env(None, "", "", False)
        self.assertEqual(mode, "presentation")
        self.assertEqual(reason, "default")

    def test_sites_default_is_presentation(self):
        mode, reason = resolve_publish_app_env(None, "", "", True)
        self.assertEqual(mode, "presentation")
        self.assertEqual(reason, "default")

    def test_flag_overrides_sites_default_to_production(self):
        mode, reason = resolve_publish_app_env("production", "", "", True)
        self.assertEqual(mode, "production")
        self.assertEqual(reason, "--app-env")

    def test_flag_overrides_local_default_to_production(self):
        mode, reason = resolve_publish_app_env("production", "", "", False)
        self.assertEqual(mode, "production")
        self.assertEqual(reason, "--app-env")

    def test_env_overrides_local_default(self):
        mode, reason = resolve_publish_app_env(None, "development", "", False)
        self.assertEqual(mode, "development")
        self.assertEqual(reason, "PUBLISH_APP_ENV")

    def test_local_env_overrides_local_default(self):
        mode, reason = resolve_publish_app_env(None, "", "homologation", False)
        self.assertEqual(mode, "homologation")
        self.assertEqual(reason, "PUBLISH_LOCAL_APP_ENV")

    def test_flag_wins_over_env(self):
        mode, reason = resolve_publish_app_env("production", "presentation", "development", False)
        self.assertEqual(mode, "production")
        self.assertEqual(reason, "--app-env")

    def test_invalid_flag_fails(self):
        with self.assertRaises(RuntimeError) as caught:
            resolve_publish_app_env("staging", "", "", False)
        self.assertIn("invalid --app-env='staging'", str(caught.exception))
        self.assertIn("presentation", str(caught.exception))

    def test_invalid_env_fails(self):
        with self.assertRaises(RuntimeError) as caught:
            resolve_publish_app_env(None, "prod", "", False)
        self.assertIn("invalid PUBLISH_APP_ENV='prod'", str(caught.exception))

    def test_empty_flag_fails(self):
        with self.assertRaises(RuntimeError):
            resolve_publish_app_env("", "", "", False)


class StampProjectJsonTest(unittest.TestCase):
    def test_inserts_when_absent(self):
        out = json.loads(stamped_project_json('{"orgName": "expansiva"}', "presentation"))
        self.assertEqual(out["appEnv"], "presentation")
        self.assertEqual(out["orgName"], "expansiva")

    def test_overwrites_existing(self):
        out = json.loads(stamped_project_json('{"appEnv": "production"}', "presentation"))
        self.assertEqual(out["appEnv"], "presentation")

    def test_rejects_non_object(self):
        with self.assertRaises(RuntimeError):
            stamped_project_json("[1, 2]", "presentation")


if __name__ == "__main__":
    unittest.main()
