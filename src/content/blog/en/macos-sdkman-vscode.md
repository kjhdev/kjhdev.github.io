---
title: "Managing Multiple Java Versions on macOS with SDKMAN - Automatic JDK Selection per VS Code Project"
pubDate: 2026-09-08T09:24:00+09:00
description: "Learn how to manage Java 17, Java 21, and multiple JDKs on macOS with SDKMAN, then combine .sdkmanrc and VS Code Java runtime settings so each project automatically uses the correct Java version."
category: Java
tags:
  - macOS
  - SDKMAN
  - Java
  - VSCode
  - JDK
  - SpringBoot
lang: en
---

When you maintain several Java projects, it is common for each project to require a different Java version.

For example, an existing Spring Boot application may use **Java 17**, while a newer application uses **Java 21**.

You can switch Java manually whenever you change projects, but this quickly becomes repetitive and error-prone.

This article configures macOS so that:

- Project A automatically uses Java 17 in the terminal.
- Project B automatically uses Java 21 in the terminal.
- The VS Code Java extensions recognize the appropriate JDK for each project.
- You do not need to run `sdk use java ...` manually every time you open a project.

The key is to combine **SDKMAN's `.sdkmanrc`** with **VS Code Java runtime settings**.

> All local paths in this article are intentionally generic and use `/Users/user/...` instead of a real macOS account name.

---

## 1. Why use SDKMAN?

If you only use one Java version on macOS, managing the JDK is relatively simple.

The problem appears when projects require different Java versions.

| Project | Java version |
|---|---:|
| legacy-api | Java 17 |
| new-api | Java 21 |

Without a version manager, you may need to keep changing `JAVA_HOME` and `PATH` whenever you move between projects.

SDKMAN makes it easy to install and switch between multiple versions of Java and other JVM-related SDKs such as Maven, Gradle, and Kotlin.

---

## 2. Install SDKMAN

On macOS with zsh, run:

```bash
curl -s "https://get.sdkman.io" | zsh
```

To load SDKMAN immediately in the current terminal:

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

Verify the installation:

```bash
sdk version
```

If SDKMAN version information is displayed, the installation is complete.

You should also be able to use the `sdk` command after opening a new terminal.

---

## 3. Check available Java versions

List Java versions available through SDKMAN:

```bash
sdk list java
```

To search for Temurin distributions:

```bash
sdk list java | grep tem
```

To display only installed Java versions:

```bash
sdk list java | grep installed
```

Check the Java version currently selected by SDKMAN:

```bash
sdk current java
```

You can also use the standard Java command:

```bash
java -version
```

---

## 4. Install Java 17 and Java 21

This article uses Temurin Java 17 and Java 21 as examples.

```bash
sdk install java 17.0.16-tem
sdk install java 21.0.8-tem
```

Exact SDKMAN version identifiers can change over time, so check the current list before installing:

```bash
sdk list java
```

After installation:

```bash
sdk list java | grep installed
```

You should see entries similar to:

```text
17.0.16-tem    installed
21.0.8-tem     installed
```

---

## 5. SDKMAN commands for switching Java

There are three commands you will use frequently.

### Switch Java only for the current shell

```bash
sdk use java 17.0.16-tem
```

This changes Java only in the current shell session.

A new terminal starts with the configured default version.

### Change the default Java version

```bash
sdk default java 21.0.8-tem
```

New terminal sessions will use Java 21 by default.

### Check the current version

```bash
sdk current java
```

Example:

```text
Using java version 21.0.8-tem
```

For projects that require different Java versions, repeatedly running `sdk use` is not ideal. That is where `.sdkmanrc` becomes useful.

---

# 6. Define a Java version per project

SDKMAN can read a `.sdkmanrc` file from the project root and apply project-specific SDK versions.

Assume the following directories:

```text
projects
├── legacy-api
└── new-api
```

`legacy-api` uses Java 17 and `new-api` uses Java 21.

---

## 7. Configure the Java 17 project

Move to the Java 17 project:

```bash
cd /Users/user/projects/legacy-api
```

Activate Java 17:

```bash
sdk use java 17.0.16-tem
```

Generate `.sdkmanrc`:

```bash
sdk env init
```

The project now contains:

```text
legacy-api
├── .sdkmanrc
├── pom.xml
└── src
```

The `.sdkmanrc` file contains:

```properties
java=17.0.16-tem
```

You can also create the file manually.

---

## 8. Configure the Java 21 project

Move to the Java 21 project:

```bash
cd /Users/user/projects/new-api
```

Activate Java 21:

```bash
sdk use java 21.0.8-tem
```

Generate `.sdkmanrc`:

```bash
sdk env init
```

Result:

```properties
java=21.0.8-tem
```

Each project now records the Java version it expects.

---

# 9. Automatically switch Java when entering a project

Creating `.sdkmanrc` alone does not necessarily enable automatic switching.

Enable SDKMAN's **auto env** feature.

The SDKMAN configuration file is normally located at:

```text
/Users/user/.sdkman/etc/config
```

Using the home-directory shortcut:

```text
~/.sdkman/etc/config
```

Find:

```properties
sdkman_auto_env=false
```

Change it to:

```properties
sdkman_auto_env=true
```

For example:

```bash
vi ~/.sdkman/etc/config
```

Then open a new terminal or reload SDKMAN:

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

SDKMAN can now read `.sdkmanrc` and switch Java when you move between project directories.

---

## 10. Verify automatic switching

Move to the Java 17 project:

```bash
cd /Users/user/projects/legacy-api
```

Check the active version:

```bash
sdk current java
java -version
```

Java 17 should be selected.

Now move to the Java 21 project:

```bash
cd /Users/user/projects/new-api
```

Check again:

```bash
sdk current java
java -version
```

Java 21 should now be selected.

The workflow is effectively:

```text
enter legacy-api
        ↓
read .sdkmanrc
        ↓
automatically use Java 17

enter new-api
        ↓
read .sdkmanrc
        ↓
automatically use Java 21
```

---

# 11. Why can VS Code still use a different Java version?

This is an important distinction.

SDKMAN's `.sdkmanrc` primarily controls the **Java version in the shell environment**.

The VS Code Java extensions run their own Java Language Server and also maintain project JDK configuration.

This means that even if the VS Code integrated terminal reports Java 17:

```bash
java -version
```

you should not automatically assume that the VS Code Java extension is using Java 17 as the project JDK.

To make the setup reliable, register the SDKMAN-managed JDKs in VS Code as well.

---

# 12. Install Extension Pack for Java

For Java development in VS Code, install:

```text
Extension Pack for Java
```

Search for it in the VS Code Extensions view.

The pack includes the main Java language support, debugger, Maven integration, and other Java development extensions.

---

# 13. Find the actual SDKMAN JDK paths

SDKMAN normally installs Java versions under:

```text
/Users/user/.sdkman/candidates/java/
```

Instead of guessing the path, use `sdk home`.

Java 17:

```bash
sdk home java 17.0.16-tem
```

Example:

```text
/Users/user/.sdkman/candidates/java/17.0.16-tem
```

Java 21:

```bash
sdk home java 21.0.8-tem
```

Example:

```text
/Users/user/.sdkman/candidates/java/21.0.8-tem
```

Use these paths in the VS Code configuration.

---

# 14. Register multiple JDKs in VS Code

Open the VS Code Command Palette:

```text
Command + Shift + P
```

Run:

```text
Preferences: Open User Settings (JSON)
```

On macOS, the user settings file is normally located at:

```text
/Users/user/Library/Application Support/Code/User/settings.json
```

Register the SDKMAN-managed Java 17 and Java 21 installations:

```json
{
  "java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem",

  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
    },
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
    }
  ],

  "java.configuration.updateBuildConfiguration": "automatic"
}
```

If your `settings.json` already contains other options, merge these properties into the existing JSON object.

---

## 15. Why is `java.jdt.ls.java.home` set to Java 21?

This is one of the most confusing parts of current VS Code Java configuration.

Recent versions of the VS Code Java Language Support extension require **JDK 21 or newer to run the Java Language Server itself**.

Therefore this setting points to Java 21:

```json
"java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
```

That does **not** mean every project must use Java 21.

A Java 17 project can still use the Java 17 runtime registered here:

```json
{
  "name": "JavaSE-17",
  "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
}
```

Think of the settings as two separate responsibilities:

| Setting | Purpose |
|---|---|
| `java.jdt.ls.java.home` | JDK used to run the VS Code Java Language Server |
| `java.configuration.runtimes` | JDKs available to actual Java projects |

A Java 17 project does not require the Language Server itself to run on Java 17.

---

# 16. Match the Maven project Java version

VS Code also reads Maven or Gradle project configuration.

If `.sdkmanrc` specifies Java 17 but `pom.xml` specifies Java 21, you have conflicting project settings.

For a Spring Boot Maven project, Java 17 is commonly declared as:

```xml
<properties>
    <java.version>17</java.version>
</properties>
```

For Java 21:

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

A generic Maven project can also use:

```xml
<properties>
    <maven.compiler.release>17</maven.compiler.release>
</properties>
```

The important part is to keep these three areas aligned:

```text
.sdkmanrc
    ↓
pom.xml
    ↓
VS Code java.configuration.runtimes
```

---

# 17. For Gradle projects

For Gradle, Java Toolchains provide an explicit way to declare the project Java version.

Java 17:

```groovy
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
```

Java 21:

```groovy
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

Keep `.sdkmanrc` on the same major Java version.

Java 17:

```properties
java=17.0.16-tem
```

Java 21:

```properties
java=21.0.8-tem
```

---

# 18. Pinning a JDK with project-level `.vscode/settings.json`

If you want stronger separation on a personal development machine, you can also store a `.vscode/settings.json` file inside each project.

For a Java 17 project:

```text
legacy-api
├── .sdkmanrc
├── .vscode
│   └── settings.json
├── pom.xml
└── src
```

`.vscode/settings.json`:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem",
      "default": true
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

For a Java 21 project:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem",
      "default": true
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

There is one disadvantage to this approach.

Paths such as:

```text
/Users/user/...
```

depend on the developer's local machine.

For a repository shared by multiple developers, committing machine-specific `.vscode/settings.json` paths may not be desirable.

For personal development, it is convenient. For team projects, it is often cleaner to register all JDKs once in **VS Code User Settings** and commit only `.sdkmanrc` and the Maven/Gradle build configuration.

---

# 19. Recommended configuration

For a macOS machine that regularly works with multiple Java projects, the following setup is simple and predictable.

## Global macOS setup

Install Java 17 and Java 21 with SDKMAN:

```bash
sdk install java 17.0.16-tem
sdk install java 21.0.8-tem
```

Enable SDKMAN automatic environment switching:

```properties
# ~/.sdkman/etc/config

sdkman_auto_env=true
```

VS Code User Settings:

```json
{
  "java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
    },
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

## Java 17 project

`.sdkmanrc`:

```properties
java=17.0.16-tem
```

`pom.xml`:

```xml
<properties>
    <java.version>17</java.version>
</properties>
```

## Java 21 project

`.sdkmanrc`:

```properties
java=21.0.8-tem
```

`pom.xml`:

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

With this arrangement, you no longer need to remember to change Java manually every time you switch projects.

---

# 20. Verify the final configuration

Open a project in VS Code and create a new integrated terminal.

Check Java:

```bash
java -version
```

Check the SDKMAN-selected version:

```bash
sdk current java
```

Check `JAVA_HOME`:

```bash
echo $JAVA_HOME
```

Check which Java Maven uses:

```bash
mvn -v
```

For Gradle:

```bash
./gradlew --version
```

To inspect the JDK recognized by the VS Code Java extensions, open the Command Palette and run:

```text
Java: Configure Java Runtime
```

This view shows the project runtime and the JDK installations recognized by VS Code.

---

# 21. When the Java version in `.sdkmanrc` is not installed

When you clone a project from Git, the Java version specified in `.sdkmanrc` may not be installed yet.

From the project root, run:

```bash
sdk env install
```

SDKMAN reads `.sdkmanrc` and installs the missing SDKs.

To manually apply the environment from `.sdkmanrc`:

```bash
sdk env
```

To leave the project environment and restore the default SDK:

```bash
sdk env clear
```

---

# 22. `sdk` is not found in the VS Code terminal

The VS Code integrated terminal may sometimes show:

```text
command not found: sdk
```

First verify that SDKMAN works in the macOS Terminal application:

```bash
sdk version
```

Then check that `~/.zshrc` contains the SDKMAN initialization:

```bash
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$SDKMAN_DIR/bin/sdkman-init.sh" ]] && source "$SDKMAN_DIR/bin/sdkman-init.sh"
```

Reload the shell:

```bash
source ~/.zshrc
```

Close existing VS Code terminals and open a new terminal afterward.

---

# 23. The terminal says Java 17 but VS Code shows Java 21

This is not necessarily an error.

The Java Language Server itself may be running on Java 21 because of:

```json
"java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
```

What matters for the application is the **project runtime**.

Open the Command Palette and run:

```text
Java: Configure Java Runtime
```

If the project JDK is Java 17, the Java 17 application is configured correctly.

These two Java versions are allowed to differ:

```text
Java Language Server → Java 21

Actual project       → Java 17
```

---

# 24. VS Code still shows the old configuration

If you changed the Java version, `pom.xml`, or Gradle configuration but VS Code still uses stale project information, run:

```text
Java: Reload Projects
```

If necessary, use:

```text
Java: Clean Java Language Server Workspace
```

VS Code will rebuild the Java project information.

---

# 25. Final project layout

Java 17 project:

```text
legacy-api
├── .sdkmanrc
├── pom.xml
└── src
```

`.sdkmanrc`:

```properties
java=17.0.16-tem
```

Java 21 project:

```text
new-api
├── .sdkmanrc
├── pom.xml
└── src
```

`.sdkmanrc`:

```properties
java=21.0.8-tem
```

SDKMAN and VS Code JDKs are configured once at the macOS user level.

The final flow becomes:

```text
open legacy-api
    ↓
SDKMAN → Java 17
    ↓
pom.xml → Java 17
    ↓
VS Code → JavaSE-17 Runtime

open new-api
    ↓
SDKMAN → Java 21
    ↓
pom.xml → Java 21
    ↓
VS Code → JavaSE-21 Runtime
```

This is much safer than manually running `sdk use java ...` every time you change projects.

It is particularly useful on macOS when maintaining Spring Boot applications that use different Java versions such as Java 17 and Java 21.

---

## SDKMAN Java command cheat sheet

| Purpose | Command |
|---|---|
| List Java versions | `sdk list java` |
| Show installed Java versions | `sdk list java \| grep installed` |
| Show current Java | `sdk current java` |
| Install Java | `sdk install java <version>` |
| Switch Java in current shell | `sdk use java <version>` |
| Set default Java | `sdk default java <version>` |
| Create project config | `sdk env init` |
| Apply project environment | `sdk env` |
| Install missing project SDKs | `sdk env install` |
| Clear project environment | `sdk env clear` |
| Show JDK installation path | `sdk home java <version>` |

---

## References

- SDKMAN: https://sdkman.io/
- SDKMAN Installation: https://sdkman.io/install/
- SDKMAN Usage / Env Command: https://sdkman.io/usage/
- Java in Visual Studio Code: https://code.visualstudio.com/docs/languages/java
- Managing Java Projects in VS Code: https://code.visualstudio.com/docs/java/java-project
- vscode-java JDK Requirements: https://github.com/redhat-developer/vscode-java/wiki/JDK-Requirements
