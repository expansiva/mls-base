#!/usr/bin/env python3
"""Unit tests for the git-managed guard: the traditional publish must leave the
projects the VM owns through git untouched (their history is the source of truth)."""

import io
import unittest
from unittest.mock import patch

from publishMlsBase import GIT_MANAGED_MARKER, git_managed_projects


class FakeRemote:
    def __init__(self, out="", error=None):
        self.out = out
        self.error = error
        self.commands = []

    def capture(self, command):
        self.commands.append(command)
        if self.error:
            raise self.error
        return self.out


class GitManagedProjectsTest(unittest.TestCase):
    def test_reads_markers_from_the_vm(self):
        remote = FakeRemote(out="mls-102043/.collab-git\nmls-102051/.collab-git\n")
        found = git_managed_projects(remote, "/data/mls-base")
        self.assertEqual(found, {"mls-102043", "mls-102051"})
        self.assertEqual(len(remote.commands), 1)
        self.assertIn(GIT_MANAGED_MARKER, remote.commands[0])
        self.assertIn("cd '/data/mls-base'", remote.commands[0])

    def test_no_markers_means_nothing_is_protected(self):
        self.assertEqual(git_managed_projects(FakeRemote(out="\n"), "/data/mls-base"), set())

    def test_ignores_lines_that_are_not_project_folders(self):
        remote = FakeRemote(out="ls: cannot access\nstatic/.collab-git\nmls-abc/.collab-git\nmls-102043/.collab-git\n")
        self.assertEqual(git_managed_projects(remote, "/data/mls-base"), {"mls-102043"})

    def test_sites_publish_has_no_remote_and_protects_nothing(self):
        # --sites does not wipe source dirs, so there is nothing to protect.
        self.assertEqual(git_managed_projects(None, "/data/mls-base"), set())

    def test_unreadable_vm_warns_and_falls_back_to_publish_managed(self):
        remote = FakeRemote(error=RuntimeError("ssh failed (255): host unreachable"))
        stderr = io.StringIO()
        with patch("sys.stderr", stderr):
            found = git_managed_projects(remote, "/data/mls-base")
        self.assertEqual(found, set())
        warning = stderr.getvalue()
        self.assertIn(GIT_MANAGED_MARKER, warning)
        self.assertIn("publish-managed", warning)


if __name__ == "__main__":
    unittest.main()
