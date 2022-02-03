# The build:readme script applies this script to the top-level monrepo
# README.md as it copies it into the p5-server directory.

# This image exceeds the 10MB content length limit for camo.githubusercontent.com.
# This doesn't actually fix the npm page.
s|](docs/\(explore.gif\))|](https://images.osteele.com/p5-server/\1)|

# Redirect link to local docs, to gh pages site.
s|](\(docs/[^)]\+\))|](https://osteele.github.io/p5-server/\1)|

# Strip suffix: *.md -> *
s|](\(https://osteele.github.io/p5-server/docs/[^)]\+\).md)|](\1)|
