# Execution evidence - VT-050

Published test-first commit: fd41104ec9e1b71ee52d263f763773d183bed0d6
Published patch commit: c5bd33ade78e10ccf5966e2d29ff887e92dd9eef

red.log and published-red.log: intentional same-key conflict failure. green/restored: 16 passing tests. mutation.log: B01 kills > to >=. repeat-01..10: isolated normal/reverse runs. summary.json and load.log: 80-task samples; in-memory harness only. Maven native verification was blocked.

Original local red/patch/mutant hashes in logs are preserved in ../VT050.bundle. To import the experiment refs from repository root:

```bash
git fetch docs/individual/23001868-vt050/VT050.bundle refs/heads/assignment/bt3-23001868-vt050:refs/remotes/archive/vt050 refs/heads/experiment/23001868-vt050-boundary-mutation:refs/remotes/archive/vt050-mutant
```

Set VT050_SOURCE_REF=0c74978 for the original failing source, or 8055e41 for the isolated mutant; unset it for the submission source. The mutant is not merged into the submission branch. Logs were executed by the coding agent, not represented as student-run production evidence.
