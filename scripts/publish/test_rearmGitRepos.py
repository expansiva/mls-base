#!/usr/bin/env python3
"""Unit tests for git-repo rearm after a successful ssh/multipass publish."""

import io
import unittest
from unittest.mock import patch

from publishMlsBase import GIT_REPOS_SETUP, rearm_git_repos


class FakeRemote:
    def __init__(self, fail=False):
        self.commands = []
        self.fail = fail

    def run(self, command, display=None):
        self.commands.append((command, display))
        if self.fail:
            raise RuntimeError("Command failed (1): rearm git repos on the VM")


class RearmGitReposTest(unittest.TestCase):
    def test_invokes_setup_with_remote_root(self):
        remote = FakeRemote()
        rearm_git_repos(remote, "/data/mls-base")
        self.assertEqual(len(remote.commands), 1)
        command, display = remote.commands[0]
        self.assertIn(GIT_REPOS_SETUP, command)
        self.assertIn("--root '/data/mls-base'", command)
        self.assertEqual(display, "rearm git repos on the VM")

    def test_failure_warns_and_does_not_raise(self):
        remote = FakeRemote(fail=True)
        stderr = io.StringIO()
        with patch("sys.stderr", stderr):
            rearm_git_repos(remote, "/data/mls-base")
        warning = stderr.getvalue()
        self.assertIn("git repo rearm failed", warning)
        self.assertIn(GIT_REPOS_SETUP, warning)
        self.assertIn("App is up", warning)


if __name__ == "__main__":
    unittest.main()
