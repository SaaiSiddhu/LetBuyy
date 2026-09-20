# ZIP_MANIFEST — LetBuyy Web V1 Wave 0 evidence archive

**Evidence artifact, not governance authority.**

- Archive: `letbuyy-web-v1-wave-0-2026-08-09.zip`
- Baseline SHA: `bf35062eda22f4d881efd61fb1d36c8fc83baed1`
- Integration branch: `codex/web-v1-integration` @ `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab`
- Date: 2026-08-09
- Wave 0 verdict: **PASS_WITH_NAMED_BLOCKERS**

## Self-reference exclusion

This manifest lists every file in the archive **except its own SHA-256**, which is
necessarily excluded: the manifest is itself archived, so embedding its own hash is
self-referential and unverifiable. The archive's SHA-256 is recorded externally at
`letbuyy-web-v1-wave-0-2026-08-09.zip.sha256`, adjacent to the ZIP.

## Handling

**Internal / ARB only.** Retains the production Supabase project ref and organization_id
(non-credential identifiers), the pooler host/region, the exact failing validators, and the
unauthenticated route set. Do not attach to a public issue, upload to a vendor portal, or
share outside the ARB. No credential, token, key, or .env content is included.

## Files

| # | Path | Bytes | SHA-256 |
|---|------|-------|---------|
| 1 | `docs/00_README_AND_AUTHORITY.md` | 16114 | `abff8e82ac1b9cfdbd9815b218be848876ac3683bab2c12baade425f2af9b623` |
| 2 | `docs/01_AUTHORITY_AND_ARCHITECTURE_BASELINE.md` | 25272 | `c035419a6bd27c75204e4859e237d11ca625e7dc3656a2daebe6982f98da969d` |
| 3 | `docs/02_GIT_BASELINE_AND_BRANCH_GRAPH.md` | 9936 | `8dada9ad53e9ad093df542b51b79ec0f625ed06dbc1edbc645187e5a2bbf8e1f` |
| 4 | `docs/03_WORKTREE_CHANGE_CLASSIFICATION.md` | 27211 | `91bcb3a9327b3914896801ea8814dafcc341d395b2443821f38af79c07265b05` |
| 5 | `docs/04_CONTENT_VS_MODE_CHANGE_REGISTER.md` | 39851 | `62af69d090dd4c17f1bf2d44be742a5be1dbac3c9e7e7b4011feec7fefcde4c2` |
| 6 | `docs/05_READINESS_ZIP_RECONCILIATION.md` | 15347 | `66870f55daa708baa5a83531e93551a4fbdf5c2e4d2a538a3b6a1e799d350d47` |
| 7 | `docs/06_LCIS_INDEPENDENT_VERIFICATION.md` | 12916 | `c30db2798835289b48356a0768c3d8a5a2ab749ca0ddc4ebb9918b008c46a426` |
| 8 | `docs/07_WEB_V1_SCOPE_REGISTER.md` | 27413 | `933374523c6a19c2b430f174d014c75777075fade31817f34d203a3e75fe5320` |
| 9 | `docs/08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md` | 14941 | `be44be1468ddecbb2f58656006f830c363544cd64e119842d757ec5af3780117` |
| 10 | `docs/09_CI_BRANCH_COVERAGE_AUDIT.md` | 16804 | `431cf39646900e9e013d639a2b985bcf9241eadd1dfa4a6dd41ee67d46ee311d` |
| 11 | `docs/10_VALIDATOR_EXECUTION_MATRIX.md` | 34100 | `a6d01a39107177974f864e4c6d09100166dd3d4e8ff2bde46c603c816c729449` |
| 12 | `docs/11_FALSE_GREEN_AND_FAIL_FAST_FINDINGS.md` | 17313 | `569c48343fdddc3b051b2f09aee93247f07f31243358c053f87c168f7f8a087e` |
| 13 | `docs/12_LOCAL_ENVIRONMENT_ISOLATION_PLAN.md` | 33798 | `b13925eaeea33a91cacccd107f6706ae8c7a89a4c78c590861ecb3d4d9221246` |
| 14 | `docs/13_REPRODUCIBILITY_AND_TOOLCHAIN_BASELINE.md` | 18649 | `6bf59650e7855d6c0f60c6730064cb575e84c2003d1c82a90aa6215c61624e2e` |
| 15 | `docs/14_INDEPENDENT_REVIEW_AND_FALSIFICATION.md` | 74062 | `1fe205c37e04eeed6f3b98959ad8041cf945dccbee48dd63c99acfdcae687585` |
| 16 | `docs/15_BASELINE_DECISION_RECORD.md` | 31821 | `0a14d5f8059a6347690971f650511d0aede4e4f2946f54f72e6bb430b74b53c9` |
| 17 | `docs/16_DIRTY_WORKTREE_PRESERVATION_RECORD.md` | 45320 | `517c35e451e49866f591ef1849ee8186f3c390151d71f80ad90816995b3b4e7b` |
| 18 | `docs/17_BRANCH_AND_WORKTREE_TOPOLOGY.md` | 13100 | `5f317496632067c8a96efd1f756cd6c4353fad647a0e077334fe463008be46d0` |
| 19 | `docs/18_REVIEWED_FIX_PORTING_REGISTER.md` | 48994 | `1cead14b9a690fbb9efa1e511dc3b7df31f6f4cef996314f439f4fa3ce744425` |
| 20 | `docs/19_CI_REPAIR_AND_BRANCH_PROTECTION_EVIDENCE.md` | 26635 | `68b99acbca2b76dfed06fed11604529c7e2019bba778ff1440a0ebd46a45450d` |
| 21 | `docs/20_VALIDATOR_RUNNER_REPAIR_EVIDENCE.md` | 32941 | `834f561ad3144ec9557d3552dcc90a0652f03860f074cfba208690c66d963954` |
| 22 | `docs/21_WEB_V1_SCOPE_FREEZE_EVIDENCE.md` | 24342 | `e6c442994560ce8ade68d197da86b499f21357732c54bbd64547d78843737155` |
| 23 | `docs/22_LOCAL_STACK_EXECUTION_EVIDENCE.md` | 24152 | `aee0736138e398eaab037d6d232ed66429567581d02526c1c81b1a93eeecb671` |
| 24 | `docs/23_BUILD_AND_TEST_BASELINE.md` | 53420 | `3fbc5bffce0258adbd8bf53ccfcc4ec95aab721d7b447f6e0e4c68971f720d86` |
| 25 | `docs/24_WAVE_0_FAILURE_AND_BLOCKER_REGISTER.md` | 90180 | `38cdc4306940d79b745e57fb10a5dd86b841ce3fbf153eb55b35eeff62e1f6e6` |
| 26 | `docs/25_WAVE_0_GATE_CERTIFICATION.md` | 52669 | `6796db222fb723c6f79b88a002d11a6865fec1d4f70bf68bf71841c5345abc77` |
| 27 | `docs/26_WAVE_1_HANDOFF_AND_DEPENDENCY_ORDER.md` | 79990 | `3cbb09c02c766e1a7cb98ba9779009eb2fa5086250db9043d92a352b3e33fbfe` |
| 28 | `docs/27_CHANGELOG_AND_EVIDENCE_INDEX.md` | 42749 | `8db10b9d6a81e56a5cb0dd1359917143d9f791556bf1ca7877f243896bc309c1` |
| 29 | `docs/28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md` | 38455 | `c354c3916ce66683f55ac73a0979cc666495dc1d820b93826b87998cefc0c5fd` |
| 30 | `docs/29_APPBRIDGE_KILLSWITCH_IMPLEMENTATION.md` | 57420 | `b01444d07a8803a50feb42b4088106cbc8507bf258caf35819f4af4d78c69f53` |
| 31 | `docs/30_CORRECTIONS_AND_STASH_HAZARD.md` | 28459 | `493d7eb807ae0b4f2711c2160d25dc6498c31c70e734921f29faed0a3b9d1093` |
| 32 | `raw-evidence/19_aggregate_gate_logic_proof.txt` | 2889 | `f2ebdac4c8e759828ee1aa5a5bb816ad48956d3ad90faa18a811eca439690b24` |
| 33 | `raw-evidence/19_seeded_regression_proof.txt` | 2861 | `e855d000838ff52dfa928f8ce739c7c546e66b315287afb0999f26e2816337e4` |
| 34 | `raw-evidence/19_tests_ci.txt` | 627 | `d7f3ca8cc9ab9842f69d1cb902273ca8461e63bf5b4514a6dcb86b0dec25f1a6` |
| 35 | `raw-evidence/19_validator_run.txt` | 203 | `9e56f49d9e20f95c9ace4899d17af5e4a3756de7977c8f8ea16c9b37b2cd304d` |
| 36 | `raw-evidence/19_yaml_syntax_validation.txt` | 1428 | `3fe2953d84ef5d2186ff5664d886c15b47f39a47673fe89b825cc4d91b03bb34` |
| 37 | `raw-evidence/A/topology-and-git-facts-2026-08-09.txt` | 875 | `46cbd1e182377cc7effae0a042d75bf88b1a6046baccf6f884d0a1b31d280620` |
| 38 | `raw-evidence/A/validate-governance-2026-08-09.txt` | 2586 | `9d0a0d2ef933ad95e506e57bcaf8e41a9b9aa13dd56003f5b5a31cba427a77e9` |
| 39 | `raw-evidence/D/app_bridge_evidence.txt` | 2775 | `9dce8216e80cdbf42489856cc99b1c9afac4b68721dacc0ab952042e82c1f6e1` |
| 40 | `raw-evidence/D/deferred_pages_head.txt` | 8762 | `fd262f9b468e1c2ddd5207f3a65658a873ccbde3c257f5164c0a886951da36bc` |
| 41 | `raw-evidence/D/feature_flag_search.txt` | 276 | `3f7136e30c67fea076ee64cea4184188039044238f089ba400a885b371071f8d` |
| 42 | `raw-evidence/D/frozen_apps_check.txt` | 8498 | `379dd6957a4067a4c1c2fa143f15f24b7bcdba1ae8e35c9a17e19b72fafe5e68` |
| 43 | `raw-evidence/D/gateway_route_mounts.txt` | 4042 | `062fbbf632838da0a677251a2e4a6cdeb195c54efffd1c58c6239e1d2b16ec89` |
| 44 | `raw-evidence/D/gw_files.txt` | 16679 | `24ff300288b41ebed0ea55538b9f4ad48f8cf7d9ee54008f641808957aea1bc3` |
| 45 | `raw-evidence/D/id_pages.txt` | 494 | `037f7812148d5fecd2a4acd57f3a9995d1cefa36db6ecd0851d6b38d00758f32` |
| 46 | `raw-evidence/D/id_routes.txt` | 1518 | `0cc21b05f8ed8e02e40044002d306fa50e5cb38dcfadde28ff3efe1b57f56b1c` |
| 47 | `raw-evidence/D/mcp_pages.txt` | 5297 | `913f49a6024bc9d4289b47b49680e856899d1edcbf0764a9a6a0c7c0df0aaed5` |
| 48 | `raw-evidence/D/mcp_routes.txt` | 10483 | `cf67f9bfbe5e7f3b74d31ec0a2e3dbd97acf740722657c73172bfae82c74d2d8` |
| 49 | `raw-evidence/D/sf_pages.txt` | 1908 | `811a073e2c43c705d5efb8af88fa587899d5a20e5249275bf6770b16f1022c91` |
| 50 | `raw-evidence/D/sf_routes.txt` | 1385 | `043601515bd9faad5045b244b970b1de01498a5a3e0ccc7c7022bf303cbe7b02` |
| 51 | `raw-evidence/D/validate-governance-output.txt` | 2593 | `c4f2767a33f01538cb9adffd68c4bb072e3f0237a716b834e36a30afef381a7a` |
| 52 | `raw-evidence/F/00_git_and_tool_versions.txt` | 1300 | `8c3c08e51ae76113c37da945c0f058620b34f4e34954f9153553349802c740dc` |
| 53 | `raw-evidence/F/01_supabase_link_state.txt` | 2324 | `995a90e395522a6da5c722b3a7ab7da8d572e7dfca47babdb80b64eb81b1e0c4` |
| 54 | `raw-evidence/F/02_port_map_and_federation_stack.txt` | 4439 | `cbf127188e53315db89cfaacc749725ba1e8fe88753c81ccf4170a29c01d30be` |
| 55 | `raw-evidence/F/03_env_template_keys.txt` | 11003 | `88589f240f47dc662e4c69d2377904841a06965e39a7be072ad204dde4882062` |
| 56 | `raw-evidence/F/04_lockfile_vs_package_json_check.txt` | 471 | `1e78291b8057bd33964560b4c896704377c02321746abd5dd4a1e4a3e75208d6` |
| 57 | `raw-evidence/F/05_toolchain_pins.txt` | 1365 | `e7cfb031f41bd4345c1dd66574a690e1b45ee0670f00c8f2e0c6fee32c84b0be` |
| 58 | `raw-evidence/W0-LOCAL-ENV/01_isolation_proof.txt` | 3317 | `81af44bf1c1fe17605c35f9e32cba8322edd29897907eaf5b21acf80d2b5d24c` |
| 59 | `raw-evidence/W0-LOCAL-ENV/02_toolchain_and_node_pin.txt` | 2691 | `4b2ae2188bd2b1e596bad575b56bfa6e276ca3bd64ac3946542742e9593f065d` |
| 60 | `raw-evidence/W0-LOCAL-ENV/03_isolated_stack_boot_proof.txt` | 5151 | `fa66e336883423fddb789975e1169e40ac99ddbe34ce7b2c13e48122493134d2` |
| 61 | `raw-evidence/W0-LOCAL-ENV/04_gateway_boot_and_baseline_build_blocker.txt` | 5456 | `737b0f665ab173b43dadce32ad2f2c438aa2f6f0d23f1dfde884cf2cabd91de4` |
| 62 | `raw-evidence/W0-LOCAL-ENV/05_app_tier_boot.txt` | 2325 | `82bce21ef109f72d5ba0a14f80c1c0fe2e822153921942a235edd61fb3cfbc75` |
| 63 | `raw-evidence/W0-LOCAL-ENV/06_nondestructive_teardown.txt` | 4490 | `cee954b28bc054149e25c997791b05acb4f6d7784a4d3359b85f0adbf7871590` |
| 64 | `raw-evidence/W0-V1-PERIMETER/01-perimeter-report.txt` | 5857 | `d761d949f2b5600f4c965594eaf9e52c9a46592f9bf5de1b3c26032f01da8d4a` |
| 65 | `raw-evidence/W0-V1-PERIMETER/02-perimeter-enforce.txt` | 231 | `214e4edb3d3d4aa70f8445d1b2565290fa5ceeb7a0a2b2dfef2b01aa81ec4167` |
| 66 | `raw-evidence/W0-V1-PERIMETER/03-negative-test-new-activation.txt` | 456 | `612bc2b06a3d7eb3af57c87da80259b831258a16094f19ebd44d2cc034b9a7ae` |
| 67 | `raw-evidence/W0-V1-PERIMETER/04-negative-test-stale-baseline.txt` | 295 | `e5cee8587e7d79d7465c64f040157e1d54d483a79c82a036fd77cbb12fed453f` |
| 68 | `raw-evidence/W0-V1-PERIMETER/05-full-gate-run-clean-worktree.txt` | 307 | `46fe95187d0019c48a4853c497a54bc0d8bf6b812be7519295be58ab730463a5` |
| 69 | `raw-evidence/W0-V1-PERIMETER/06-design-system-clean-worktree.txt` | 1985 | `a8fbaca59177c94625c705805c1c46f5d0765b37b7a1ee0a7c6f35c05e08226d` |
| 70 | `raw-evidence/agent-c/agent-c-command-log.txt` | 5921 | `e52bf3ac7be25e1490fb78aba7f993bea264a67238f5f67cb6927f84af05af2a` |
| 71 | `raw-evidence/agent-c/validate-governance-stdout-exit1.txt` | 2671 | `9c6d9338c44e84d23149d11cffa30c2974a39828f1f20226b2eeafb73a6c3d62` |
| 72 | `raw-evidence/agent-e/catch-without-exit-heuristic.txt` | 211 | `d71ec2ebe6bbd913517583afeb558ff74ad3a452b3c9862e7a297fe27c5d5771` |
| 73 | `raw-evidence/agent-e/github-branch-protection-check.log` | 1040 | `27da1b0110d614c3e7e10f1c9d2895ebd9d388bc772f9432d7f11dbc81aa8c06` |
| 74 | `raw-evidence/agent-e/pnpm-lint.log` | 14944 | `c7cc947ddabbb95bc852afb8f4469206fef6c64cc0408ab968d808535080d70f` |
| 75 | `raw-evidence/agent-e/pnpm-typecheck.log` | 26310 | `906677c368c57eb580be4be5451ab945f9814c1325e3a8663013f8b4ea0ae319` |
| 76 | `raw-evidence/agent-e/root-package-scripts.txt` | 15284 | `d078dd9cfbdd77b97fe896dab4ebdfa1b7e5fc4cfdf0509ff57d3f629d8e5ab8` |
| 77 | `raw-evidence/agent-e/validate-governance-gate-lane.log` | 2598 | `f2b61cb4ea8d6364ac1424d406626e4a0a6975feef224bf667ff7949c0ec7f9e` |
| 78 | `raw-evidence/agent-e/workflow-triggers-raw.txt` | 5872 | `9df807fa71e1b9df4470c3032d01c5c8b1d1f0868151cdd5d559f9658adc5bfe` |
| 79 | `raw-evidence/appbridge-urgent/30_final_test_results.txt` | 775 | `9b6fd554d00dcb6e7c41e472972082e4407d20629df27f4e2e4baa420cc7a025` |
| 80 | `raw-evidence/appbridge-urgent/31_bypass_reproduction_and_closure.txt` | 6716 | `24ea408534e61ac9b748c5acaa7a9281f7c6f856a35e8f7882ac7880e67cfcc3` |
| 81 | `raw-evidence/appbridge-urgent/32_falsification_and_regression.txt` | 1701 | `be4d8e50ef1e2415979b1a2ce40ca01a1283c7c278e7e3111ac94539726ce956` |
| 82 | `raw-evidence/appbridge-urgent/killswitch-raw/appbridge-existing.log` | 730 | `3485716bbc92b35e2bab2db10fd05bb549ad381ae030fcf71112c09c9a945583` |
| 83 | `raw-evidence/appbridge-urgent/killswitch-raw/commit-df4abd5d.stat` | 4229 | `01004daf940ae3011bc9ef0b6c63e0c31171abe100626dca0cfdca5d4bb71ded` |
| 84 | `raw-evidence/appbridge-urgent/killswitch-raw/gov.log` | 307 | `46fe95187d0019c48a4853c497a54bc0d8bf6b812be7519295be58ab730463a5` |
| 85 | `raw-evidence/appbridge-urgent/killswitch-raw/ks-falsify.log` | 231536 | `28eca397dd1a0421b43848ed19b9ce223b7a88e4944f6ed6199557e00039fcd4` |
| 86 | `raw-evidence/appbridge-urgent/killswitch-raw/ks-final.log` | 2098 | `8078f826d5e8646d00840033cdd5fa9a4e122fc5b5108e47a7c59f34949957ab` |
| 87 | `raw-evidence/appbridge-urgent/killswitch-raw/tsc-gateway.log` | 2588 | `0f11435db7fdde46935c831f37048d2f1f68e0cf6c74bb86e21c6a281bf13992` |
| 88 | `raw-evidence/appbridge-urgent/killswitch-raw/ui-ks.log` | 555 | `7aeb9cb50f487db812a09cb6727adc8f268f067ac0781c30bed7bb8901def48d` |
| 89 | `raw-evidence/appbridge-urgent/lens1-gateway-mounts.md` | 27444 | `dfe7c05df53bddf7822bd60be482ee79af124df8e08b3574b5c24eb5ab062235` |
| 90 | `raw-evidence/appbridge-urgent/lens2-ui-config-shapes.md` | 24982 | `bcced24b5521fa83e44aaba2e4029d5f48ddba00c7bfee73746a6ee532ea48d7` |
| 91 | `raw-evidence/appbridge-urgent/lens3-executable-proof.md` | 21216 | `a9b0fedbf33de0121dc5836a2123f3b5ad4af9c1f61d2d1992bf56818dbef410` |
| 92 | `raw-evidence/appbridge-urgent/probe-raw/enumerate.mts` | 1428 | `f3ac9e57f8f1a00f5fd41db2996a66d721e19066284017f65fbe00efdf51ed1b` |
| 93 | `raw-evidence/appbridge-urgent/probe-raw/isolated.json` | 13719 | `dad6e3f57bb7d40e2d59b85ae819fb1b010ee00d34659ac1c985111f6e555a58` |
| 94 | `raw-evidence/appbridge-urgent/probe-raw/matrix.md` | 13397 | `80e4621b3ff3a936ac5bc3a1c36de00ec51195f2ba506e4cc88f7a87947ea275` |
| 95 | `raw-evidence/appbridge-urgent/probe-raw/probe2.mts` | 7633 | `bd677729cdfa9c86fb096494274969e9b0749242b03adf55edd3ec0d2f308364` |
| 96 | `raw-evidence/appbridge-urgent/probe-raw/probe3-isolated.mts` | 3511 | `6872cdc6ce3e2e3257fe35ccbdb38f06286982d01fa8226591410740091e08c0` |
| 97 | `raw-evidence/appbridge-urgent/probe-raw/production.json` | 32079 | `0872aa17e23029b9749b9acbfed1d5d0c0bb7a43a2a401acdf2b321e0a999279` |
| 98 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-mount-probe/hono-matcher.probe.test.ts` | 2796 | `45d43a7257fcbbd6b0f50542fc1d24875c84cb96cb273966ba0382ee06d17d44` |
| 99 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-mount-probe/mount-bypass.probe.test.ts` | 8354 | `3770245876d706b2326d95e256c54c55bfae9cd63915b8f02c453784bec5eee0` |
| 100 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-mount-probe/path-variant.probe.test.ts` | 3007 | `e9fa8e7c32c21a4ad68d384e2c616c3bc11f5418dd222b74e2a6bb5ad469616b` |
| 101 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/probe.mts` | 5389 | `f170c83c6720c3654eae072027397522e1658e530e7a01fdc6d136dda0bc6784` |
| 102 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/skeptic3-decisive.probe.mts` | 3584 | `f62fe754edbcc859442db1466a175c5b1a3b60ef220a05a6911886ece1c9926a` |
| 103 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/skeptic3-proxy-bypass.probe.mts` | 5966 | `84f64811ebe34c9a1641fe60d5655fc2f1d48a2628479566849c0098b4e38448` |
| 104 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/skeptic3-router-match.probe.mts` | 1454 | `da028fc470c3f9144a450334a7d778d3e930c49780d9e4d8a2d8f722b223e74e` |
| 105 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/smoke-import.mts` | 1061 | `2dd3c4f3ba082004f66b4dc040b906780ebfb286fe7496ad2591e29a6554e6c7` |
| 106 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-probe-cfg-bypass/probe.test.ts` | 8796 | `e05bd300b52ad0b4fe3f9f6e00f1f9c5a9883271ab2e5b901da4c1d9598086f4` |
| 107 | `raw-evidence/appbridge-urgent/reproduction-probes/tmp-probe-cfg-bypass/probe2.test.ts` | 1161 | `1869f967240985196572998b8058ecfbd49f37ec805ddee25bab9e269a2474db` |
| 108 | `raw-evidence/build-baseline/00_COMMAND_LEDGER.tsv` | 12917 | `2c86d67fcecb9c3f826d268f79e6d06c887a59425fabfd9ea39cb1f0cf02a038` |
| 109 | `raw-evidence/build-baseline/01_pnpm_install_frozen_lockfile.log` | 790 | `5f8ffcb75e62a292f0a800af478a4896fefa027998bdd508270d34d9023e9298` |
| 110 | `raw-evidence/build-baseline/02_governance_plan_gate.log` | 7667 | `e9b2779a502e8b10931c74e7dca6364578757b12194a9e70eb97e43b94413c20` |
| 111 | `raw-evidence/build-baseline/03_governance_gate_full.log` | 50648 | `9af337a9c3256438b582ec85d2e2cdf2f1848db10ad5cf0fd9dcfeb43e72a4ec` |
| 112 | `raw-evidence/build-baseline/04_governance_report_lane.log` | 10751 | `469db83de275d66688d319ec6eea716525726ec47e11d60e961a8341be338f18` |
| 113 | `raw-evidence/build-baseline/05_pnpm_install_after_governance_cleanup.log` | 799 | `1edb1b37ccbd6241c8ec0d878c7b1da8d1e05dcb453ec77b4cd5350b15871d26` |
| 114 | `raw-evidence/build-baseline/06_validate_migrations.log` | 927 | `e42d71f8af88fc8bfa3310d51530db7a0f3b4d26a378d0f7bf9e49e4c528b6ff` |
| 115 | `raw-evidence/build-baseline/07_sequential_migration_validator.log` | 819 | `3cdb3b20141f6fe6f80ead503bcccd5010b8c468b7836dc52f5db58ff69b2974` |
| 116 | `raw-evidence/build-baseline/08_rollback_integrity_validator.log` | 748 | `f86e7b4b3d1a233e6c6c707f928a507009135066ec628c0b99fa1dbc25e15700` |
| 117 | `raw-evidence/build-baseline/09_typecheck_root.log` | 32342 | `c83f9f295d4049d4993a90e38307e75f24a0d5a713e553b78f7475fc5bf762c8` |
| 118 | `raw-evidence/build-baseline/10_lint_root.log` | 49236 | `b41da952aa3365e43b32e8670ae0ecf64901bd6965a9c34c3191212ce1169e28` |
| 119 | `raw-evidence/build-baseline/11_lint_root_continue.log` | 7280 | `174528347ca8a7af30ebea2e87d986fecbe2b20b4f5959cf9c456dae1c8c07b7` |
| 120 | `raw-evidence/build-baseline/13_build_api_gateway.log` | 815 | `5c6b57812aa8768a8f3f3f39ea96426df578a8867e6baa3a5bb9accdcba33829` |
| 121 | `raw-evidence/build-baseline/14_bundle_api_gateway_esbuild.log` | 1063 | `79ffc31320bf3496193ae15840f10912ea212050218e764f769c4547687bac3a` |
| 122 | `raw-evidence/build-baseline/15_build_merchant_control_plane.log` | 9841 | `586ceb246d747c4a41423d606c691d632a4749dd92417fbca7736e22cf7a2721` |
| 123 | `raw-evidence/build-baseline/16_build_storefront_runtime.log` | 3356 | `1231834fdad01cfef65424803538c57887a08deae40a6c16d94f1df8083d8acc` |
| 124 | `raw-evidence/build-baseline/17_build_identity_platform.log` | 2685 | `3b6ec377e8b24e1f401376fe06a05b71465b2cc1c29bd1caee134e4832533b60` |
| 125 | `raw-evidence/build-baseline/18_build_root_all.log` | 38246 | `b5ee83acbad8c0d3ac1f805e3efb8ead6dd6384548a48b313179b6ee2572cb3e` |
| 126 | `raw-evidence/build-baseline/19_build_platform_console.log` | 1598 | `89a361c4f9d1388db6ed860e046ddfeee07f6f46619baf802c8e0cefbee0060a` |
| 127 | `raw-evidence/build-baseline/20_build_marketing_site.log` | 3976 | `c50cb50218c24115912e781a1cfcf24184d93ea12da2ee506979196a205f7689` |
| 128 | `raw-evidence/build-baseline/21_build_mobile_bff.log` | 811 | `eb3d8dac9f3680ea57db9500ae54c700954481a98065323a97034aa9655fd9e0` |
| 129 | `raw-evidence/build-baseline/22_build_webhook_service.log` | 831 | `d88967098243a37bbcfe491fe4fc87efb77e99ea04f9674c493421aed2cf3965` |
| 130 | `raw-evidence/build-baseline/23_build_queue_workers.log` | 823 | `6d3449c496ba03c5be4727008d4e3ba9e73ac463527780d4391e0b32dc17a364` |
| 131 | `raw-evidence/build-baseline/24_test_behavioral.log` | 270473 | `cb7b69d5923aa147059483baacbaaf432018a2f86d3a5b9574f3f99b9497fd6a` |
| 132 | `raw-evidence/build-baseline/25_ephemeral_postgres_start.log` | 767 | `96e41254c4f89de7e01551179d397a610646f2ab226705ef006e036eba4bf35d` |
| 133 | `raw-evidence/build-baseline/26_test_behavioral_with_pg.log` | 295276 | `123be51fda0048bc4d963b32c4e4bccb155917378abb891c5abc8266fa1be97e` |
| 134 | `raw-evidence/build-baseline/29_test_security_suite.log` | 1225 | `c0bbf7e3aa8615bd573bcfa3252e76d2659155d0e3612db3709f106979a79320` |
| 135 | `raw-evidence/build-baseline/30_test_auth_suite.log` | 3983 | `469fde42a97d51e515f1915cec5b99f4c8e695233f21daef25eb8f877a46d997` |
| 136 | `raw-evidence/build-baseline/32_test_payment_postgres_isolated.log` | 4431 | `b84934ec3ddbf50f2f46460b928ea0a07db4526b74c68a9cb9de686a93974df2` |
| 137 | `raw-evidence/build-baseline/35_lint_css.log` | 1116 | `615b1c37f9034dc1be17d5e28996366b73231a02eb988bcb8aab2684ac4b4240` |
| 138 | `raw-evidence/build-baseline/36_ephemeral_postgres_stop.log` | 761 | `ade59b1af73e27b200d172281eb95435a5f7254bdd838ae01639058d02ff5ae2` |
| 139 | `raw-evidence/build-baseline/37_node_test_missing_path_probe.log` | 1082 | `de13633b8a1e8e1968c3d441af7c6bc2249a2dddf8eb783da65c6c6c7c1c9389` |
| 140 | `raw-evidence/certification/25_certification_transcript.txt` | 18263 | `0cda081c512e342cf0a809dbaafb5b13b92b0dbd7d8ba1dede1dd0d351cf55e4` |
| 141 | `raw-evidence/doc-corrections/678-binary-mode-only-paths.txt` | 62356 | `0c15fcd135abd9904fb9abe20157eabad5f92ea6cbb2c2c9e022d8b19ccba30c` |
| 142 | `raw-evidence/doc-corrections/99-real-content-changed-paths.txt` | 5555 | `2cf2c462f754f48a054b425faf77d2ec52395b348bed7eff7b2aeeef8243678c` |
| 143 | `raw-evidence/doc-corrections/stash0-28-files.txt` | 1337 | `607741eb4070196cf96bc22345ce51602029f1b47a46046586b303f1c2b1cdbb` |
| 144 | `raw-evidence/doc-corrections/stash0-numstat.txt` | 1473 | `7ce7787f431d5145573803c6f58f69b4dffb8f56ad86bc426619df028c460598` |
| 145 | `raw-evidence/doc-corrections/verification-transcript-2026-08-09.txt` | 6672 | `6aea2061622ff8b51748395bda395901d591fbfff5c1dad3c28782d5d6f5b11c` |
| 146 | `raw-evidence/g/app-store-mount-rerun.txt` | 4097 | `b4580a592abf72262f05d196880853159843a4e21f692e12951c5d29b52a6087` |
| 147 | `raw-evidence/g/constitution-agents-citation-check.txt` | 2460 | `6d50dcdef15f046a8f92ee208da2c6d6bc526bdc3fa25768bbbe679ed0badb00` |
| 148 | `raw-evidence/g/git-counts-rerun.txt` | 959 | `e3053cb18ced3f47fdad233d5b57af26eb286f9778513f4349b4941b4d244161` |
| 149 | `raw-evidence/g/governance-gate-rerun.txt` | 2598 | `f2b61cb4ea8d6364ac1424d406626e4a0a6975feef224bf667ff7949c0ec7f9e` |
| 150 | `raw-evidence/g/identity-platform-lint-rerun.txt` | 8685 | `2f28dae9a59b6fd7f6853c4f6865d60325bd118978c5e58114dfaf6fac974db4` |
| 151 | `raw-evidence/g/secrets-scan-rerun.txt` | 3135 | `9cf711dd3d306e71b0bc1323a6d9381b4cbae972cb4e8b824c07259f4437e3da` |
| 152 | `raw-evidence/g/supabase-link-state-rerun.txt` | 1625 | `a94a2b3ffd641bc227e9825af14754fa745b6f312265947139ff6452997deae4` |
| 153 | `raw-evidence/preservation/BINARY_MODE_ONLY_PROOF.tsv` | 120708 | `7e2d96bbe7f5dd5a29280fb958a4de4e822687a6d0ff1aa8fff56719cb18f85d` |
| 154 | `raw-evidence/preservation/DISPOSITION_REGISTER.tsv` | 44601 | `c6d34185a73abdc91c997bb783e4b91dd2b8abd7eaa4e7841550fc6b862cf234` |
| 155 | `raw-evidence/preservation/ROUNDTRIP_PROOF.tsv` | 19337 | `f031966db6ec2db0a591af55cdbb649401dd6833401bdf0c4a96346fb7b6128a` |
| 156 | `raw-evidence/preservation/SHA256SUMS.tsv` | 33919 | `ac6c0cb4114e3d6bd1edc34034095e3d16b1f670dfd405ac6fc8bbdf6cfd0a50` |
| 157 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__migrations__196_theme_rls_tenant_hardening.sql` | 6250 | `660dfcc2b9f94389d98389e16e031550a6b9d185b294607bd8b42878f17b478c` |
| 158 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__migrations__197_letbuyy_core_first_class_theme.sql` | 19974 | `593d1559b1adff9dca08428e111be56ed6d440afaf51a813960fa136130dee83` |
| 159 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__180_urban_kicks_liquid_theme.rollback.sql` | 3119 | `1c5963ed136165a3d5a60afa9eaec3a6eef1e2a5d450895211762252c3097358` |
| 160 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__181_urban_kicks_settings_schema_complete.rollback.sql` | 885 | `0e3b30c178e600c9ca3103af56aaef0d3c918cb1d31a4ef3cd66d86ef3e8b116` |
| 161 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__188_letbuyy_core_theme_row.rollback.sql` | 2325 | `887ce75b162ac696002b96856ab9299f3f60182827c895159b7c0645c5601524` |
| 162 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__189_theme_persistence_idempotency.rollback.sql` | 776 | `54e1d754e968c3bcab543d553db4c4ff5474c46f84739af7ddf04cf22145b852` |
| 163 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__190_theme_library_q.rollback.sql` | 1875 | `aec476cd84f9c6f571ca8767632db157c0007066a568301fb9c11d71efdb0bf0` |
| 164 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__191_theme_purchases_rls_tenant_scope.rollback.sql` | 1711 | `a82de7f5031fa027d62d25717e19dc42cd2f46e5ed048983bcb0e84e46d393bf` |
| 165 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__196_theme_rls_tenant_hardening.rollback.sql` | 3253 | `fef5043be7cc120a79916892dba87b5bb34e87977f15dcdfceec7eb4bbbcaf06` |
| 166 | `raw-evidence/preservation/intent-to-add-raw/database__supabase__rollback__197_letbuyy_core_first_class_theme.rollback.sql` | 3761 | `20b486dc5838913d08d8479a68f799659c593a53319eaef8b64d898bfb53b452` |
| 167 | `raw-evidence/w0-validator-execution/20_orchestration-tests.log` | 2577 | `042036e1716c5d287ab30661c67a8c0e80c1ab3829bf6911e4277a936f94168b` |
| 168 | `raw-evidence/w0-validator-execution/20_post-repair-gate-matrix.json` | 31746 | `6869cf0b53a5303826651dca1b501151f245e344c8573d338de88bfaf94856fe` |
| 169 | `raw-evidence/w0-validator-execution/20_post-repair-gate.log` | 49218 | `04c3bd4ec0fd3515a3d14a9bb896a1c5a6cd71e5538031e75ef246ecd6dff733` |
| 170 | `raw-evidence/w0-validator-execution/20_post-repair-report-lane.json` | 34980 | `340895f18f4e5cdabc6abbd3d7497db87a7c1038a99e9dea8a097f45a23883c7` |
| 171 | `raw-evidence/w0-validator-execution/20_post-repair-report-lane.log` | 10113 | `e1b3f09da3eda974a3fdbbc87d95b873155d480eb1e9b95d5870fc123f3e5392` |
| 172 | `raw-evidence/w0-validator-execution/20_pre-repair-gate.log` | 307 | `46fe95187d0019c48a4853c497a54bc0d8bf6b812be7519295be58ab730463a5` |
