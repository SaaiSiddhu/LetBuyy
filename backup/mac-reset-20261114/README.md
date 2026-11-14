# LetBuyy Mac reset backup

Original local snapshot commit: ebe76c89b00e51ffde370400c03d8fc0ae2d46f7

GitHub base commit: e4105581e3346041d71694d3db093eb713773e07

This branch preserves the local workspace snapshot. The live workflow directory uses the GitHub base versions. The original workflow tree and raw Git commit metadata are saved in this directory so the exact local snapshot can be recovered.

The first backup commit preserves 4,398 changed paths, including the source, reports, archived candidate build inputs and recent Lighthouse traces.

Local environment files, secrets, signing identities and the local database are outside this Git backup.

To restore the original commit, extract original-workflows.tar.gz into the working tree. Use a separate index seeded from this backup, remove backup/mac-reset-20261114, stage the restored workflow tree into the separate index, then compare its git write-tree SHA to the tree line in original-commit.txt. Once the tree hash matches, git hash-object -t commit -w original-commit.txt recreates the original commit object. The parent is already in the repository history.
