# Continuous integration

<!-- vim-markdown-toc GFM -->
* [Jenkins](#jenkins)
	* [Intern as a post-build action to an existing project](#intern-as-a-post-build-action-to-an-existing-project)
	* [Intern as part of a free-style software project](#intern-as-part-of-a-free-style-software-project)
	* [Intern as an execution step in a Maven pom.xml](#intern-as-an-execution-step-in-a-maven-pomxml)
* [Travis CI](#travis-ci)
* [TeamCity](#teamcity)
	* [Intern as an additional build step](#intern-as-an-additional-build-step)
	* [Intern as a separate build configuration](#intern-as-a-separate-build-configuration)
* [Codeship](#codeship)
	* [For a new project:](#for-a-new-project)
	* [For an existing project:](#for-an-existing-project)
	* [Setup Commands](#setup-commands)
	* [Configure Test Pipelines](#configure-test-pipelines)
* [Bamboo](#bamboo)
	* [Manage elastic instances](#manage-elastic-instances)
	* [Create a build plan](#create-a-build-plan)
	* [Configure your build plan](#configure-your-build-plan)
	* [Running your build plan and verifying its output](#running-your-build-plan-and-verifying-its-output)

<!-- vim-markdown-toc -->

## Jenkins

When integrating Intern with Jenkins, there are two primary ways in which the integration can be completed: either creating a new project that executes as a post-build action for your primary project using a shared workspace, or by creating a multi-step free-style software project that executes Intern after the first (existing) build step.

For projects that are already using Maven, a third option is to execute Intern using [`exec-maven-plugin`](http://mojo.codehaus.org/exec-maven-plugin/) from an existing `pom.xml`.

When using Intern with Jenkins, use the `junit` reporter and enable the “Publish JUnit test result report” post-build action for the best test results display.

To add code coverage data to Jenkins, add the `cobertura` reporter, install the Cobertura plugin for Jenkins, and enable the “Publish Cobertura Coverage Report” post-build action.

### Intern as a post-build action to an existing project

This option enables you to use an existing build project by adding a new project that executes unit tests in a separate job from the main build. This option is ideal for situations where you want to be able to manage the build and testing processes separately, or have several projects that need to be built downstream from the main project that can occur in parallel with test execution.

In order to accomplish this efficiently without the need to copy artifacts, use of the Shared Workspace plugin is recommended. To install and configure the Shared Workspace plugin, follow these steps:

1.  Install the Shared Workspace plugin from the Jenkins → Manage Jenkins → Manage Plugins page.
2.  Go to the Jenkins → Manage Jenkins → Configure System page.
3.  Under Workspace Sharing, add a new shared workspace. For the purposes of these instructions, this shared workspace will be called “myApp”.
4.  Save changes.

Once the Shared Workspace plugin is installed, all projects that need to share the same workspace must be updated. The shared workspace for each project can be selected from the first section of the project’s configuration page.

Once the main project is set to use the shared workspace, the new unit test project should be created:

1.  Create a new free-style software project, e.g. “myApp-tests”.
2.  At the top of the configuration, change the shared workspace to “myApp-tests”.
3.  Under “Source Code Management”, leave the “None” option checked. Because of the shared workspace, source code checkout will be handled by the upstream project.
4.  Under “Build triggers”, check the “Build after other projects are built” checkbox. Enter the name of the existing Maven project in the text box that appears. (This will create a corresponding post-build action to build “myApp-tests” in the existing project’s configuration.)
5.  Under “Build”, click the “Add build step” button and choose “Execute shell” from the drop-down.
6.  Under “Execute shell”, enter the command you want to use to run Intern. See the <a href="https://theintern.github.io/theintern/intern/wiki/Running-Intern" class="internal present">Running tests</a> section for possible commands.
7.  Save changes.

Once this project has been configured, test everything by running a build on the main project. Once the main project build finishes successfully, the new “myApp-tests” project will begin executing automatically.

### Intern as part of a free-style software project

When working with an existing free-style software project it is possible to simply add the unit testing as an extra build step, following steps similar to the above:

1.  Open the configuration page for the existing free-style software project.
2.  Under “Build”, click the “Add build step” button and choose “Execute shell” from the drop-down.
3.  Under “Execute shell”, enter the command you want to use to run Intern. See the [Running tests](https://theintern.github.io/intern/#runnin-intern) section for possible commands.
4.  Save changes.

### Intern as an execution step in a Maven pom.xml

Intern can be executed by Maven from a `pom.xml` during the test or integration-test phases of the build by using the `exec-maven-plugin` to spawn a new Intern process:

    <plugin>
      <artifactId>exec-maven-plugin</artifactId>
      <groupId>org.codehaus.mojo</groupId>
      <version>1.2.1</version>
      <executions>
          <execution>
          <id>run-tests</id>
          <phase>test</phase>
          <goals>
            <goal>exec</goal>
          </goals>
        </execution>
      </executions>
      <configuration>
        <executable>node_modules/.bin/intern-runner</executable>
        <arguments>
          <argument>config=tests/intern</argument>
        </arguments>
      </configuration>
    </plugin>

The `executable` and `arguments` elements should be modified to run Intern using your desired executor and configuration.

## Travis CI

In order to enable [Travis CI](http://travis-ci.org/) builds for your project, you must first create a `.travis.yml` in your repository root that will load and execute Intern:

    language: node_js
    node_js:
      - '0.10'
    script: node_modules/.bin/intern-runner config=tests/intern

If you are using a cloud hosting provider like BrowserStack, Sauce Labs, or TestingBot, you can add [environment variables](https://theintern.github.io/intern/#hosted-selenium) holding your access credentials either through the Travis CI Web site by going to the repository’s settings page, or by [adding an `env` list](http://docs.travis-ci.com/user/environment-variables/) to your .travis.yml configuration.

Once you have a Travis configuration, you just need to actually start the thing:

1.  Go to <https://travis-ci.org/>
2.  Click “Sign in with GitHub” at the top-right
3.  Allow Travis CI to access your GitHub account
4.  Go to <https://travis-ci.org/profile>
5.  Click “Sync now”, if necessary, to list all your GitHub projects
6.  Click the on/off switch next to the repository you want to test

The next time you push commits to the repository, you will be able to watch Intern happily execute all your tests directly from the Travis CI Web site. Any time you make a new commit, or a new pull request is issued, Travis will automatically re-run your test suite and send notification emails on failure.

## TeamCity

There are two primary ways that Intern can be integrated with a [TeamCity](http://www.jetbrains.com/teamcity/) project: either by adding a new build configuration that is chained using a post-build trigger, or by adding additional build steps to an existing build configuration.

When using Intern with TeamCity, use Intern’s `teamcity` reporter for best integration.

### Intern as an additional build step

1.  Go to the project that you want to add Intern to and click “Edit Project Settings” at the top-right.
2.  In the left-hand menu, click “General Settings”.
3.  Under “Build Configurations”, click “Edit” on the existing build configuration you want to add Intern to.
4.  In the left-hand menu, click “Build Steps”.
5.  Click “Add build step”.
6.  Select “Command Line” from the “Runner type” drop-down.
7.  Enter a name like “Run Intern” as the step name.
8.  Select “Custom Script” from the “Run” drop-down.
9.  Under “Custom script”, enter the command you want to use to run Intern. See the [Running tests](https://theintern.github.io/intern/#running-intern) section for possible commands.
10. Click “Save”.

### Intern as a separate build configuration

1.  Go to the project that you want to add Intern to and click “Edit Project Settings” at the top-right.
2.  In the left-hand menu, click “General Settings”.
3.  Under “Build Configurations”, click “Create build configuration”.
4.  Enter a name like “Intern” as the build configuration name.
5.  Click “Save”.
6.  In the left-hand menu, click “Build Steps”.
7.  Click “Add build step”.
8.  Select “Command Line” from the “Runner type” drop-down.
9.  Enter a name like “Run Intern” as the step name.
10. Select “Custom Script” from the “Run” drop-down.
11. Under “Custom script”, enter the command you want to use to run Intern. See the [Running tests](https://theintern.github.io/intern/#running-intern) section for possible commands.
12. Click “Save”.
13. Go back to the settings page for the project.
14. In the left-hand menu, click “General Settings”.
15. Click “Edit” on the build configuration you want to trigger Intern from.
16. In the left-hand menu, click “Triggers”.
17. Click “Add new trigger”.
18. Choose “Finish Build Trigger” from the drop-down.
19. Under “Build configuration”, choose the Intern build configuration that was just created.
20. Check “Trigger after successful build only”.
21. Click “Save”.

## Codeship

To use Intern with [Codeship](https://codeship.com/), you’ll need to configure a test pipeline:

### For a new project:

1.  Log in to Codeship.
2.  In the upper-left corner, click “Select Project...”.
3.  Click the “Create a new project” button.
4.  Connect your GitHub or Bitbucket account as required.
5.  Choose the repository you’d like to test.
6.  Select “I want to create my own custom commands” from the dropdown box labeled “Select your technology to prepopulate basic commands”.
7.  The following steps are the same as for an existing project.
8.  Once completed, click “Save and go to dashboard” and then push a commit to see your build tested.

### For an existing project:

1.  Log in to Codeship.
2.  In the upper-left corner, click “Select Project...”.
3.  Select the gear icon to the right of your project’s name.
4.  From the “Test” Project Settings page, select “I want to create my own custom commands” from the dropdown box labeled “Select your technology to prepopulate basic commands”.
5.  The remaining steps are identical to creating any new project with Codeship.

### Setup Commands

Setup Commands are those that allow you to set up your environment. For testing a project with Intern, you must install node and your project’s dependencies:

    # Install the version of node specified in your package.json
    nvm install node

    # Install project requirements
    npm install
                  

### Configure Test Pipelines

The test pipeline is what actually runs your specified test commands. This is equivalent to running the tests on your local development environment. For example, to run the Intern self-tests with the `intern-client`, you would enter the following command:

    # run the intern-client with the specified configuration
    node_modules/.bin/intern-client config=tests/selftest.intern.js
                  

If you want to run tests with Selenium, Codeship supports this as well! You just need to [curl and run this script](https://github.com/codeship/scripts/blob/master/packages/selenium_server.sh) before calling the `intern-runner` with a `NullTunnel`.

    curl -sSL https://raw.githubusercontent.com/codeship/scripts/master/packages/selenium_server.sh | bash -s
    node_modules/.bin/intern-runner config=tests/selftest.intern.js tunnel=NullTunnel
                  

## Bamboo

Using Intern with Bamboo involves creating a build plan, described below. Note that the instructions below were tested using Bamboo Cloud edition, but configuring a build plan task should work similarly using a local agent.

### Manage elastic instances

By default, if you run a build on Bamboo and an agent isn’t available, an Elastic Bamboo image is started as a Windows Server instance. Intern behavior is more consistent running in a POSIX compliant environment, so follow the steps below to create a Linux instance:

1.  From the gear icon menu in the upper-right corner of any Bamboo administration page, select “Elastic instances”.
2.  Click the “Start new elastic instances” button in the upper-right corner of the page.
3.  Under the “Elastic image configuration name” dropdown, select “Ubuntu stock image”.
4.  Click the “Submit” button.

You will be taken to the “Manage elastic instances” page, where you will see your image and its current state. Once the image status is “Running”, the Elastic Agent starts. Once the agent has started and is either “Pending” or “Idle”, you may begin your build.

### Create a build plan

1.  Click the “Create” dropdown button at the top-middle of any Bamboo administration page.
2.  Select “Create a new plan” from the menu.
3.  Select or create a Project to house the build plan.
4.  Give the build plan a name and key, for your reference, and provide an optional description.
5.  Link the build plan to a previously linked or new repository.
6.  Click “Configure plan”.

### Configure your build plan

By default, the plan starts with an initial task of “Source Code Checkout”, which you can leave configured as is, because you linked the repository in a previous step.

1.  Add a task of “npm”.
2.  Use Node.js executable “Node.js 0.12” (or newer).
3.  Provide it with a Command of “install” and save the task.
4.  Add a task of “Script”.
5.  In the script body, write the following (use the version of node chosen in step 2):

        /opt/node-0.12/bin/node ${bamboo.build.working.directory}/node_modules/.bin/intern-client \
          config=tests/selftest.intern \
          reporters=JUnit \
          > results.xml
                      

6.  Save the Script task.
7.  Add a task of “JUnit Parser”.
8.  Enter “\*” in the “Specify custom results directories” field and save the task.
9.  Below the task configuration interface, make sure “Yes please!” is checked under the “Enable this plan?” heading.
10. Click the “Create” button to create your build plan.

### Running your build plan and verifying its output

1.  Click the “Build” dropdown menu item from the Bamboo administration page top menu and select “All build plans”.
2.  Select your plan from those shown.
3.  Click “Run” and then “Run plan” in the upper-right corner of the page.
4.  Once your plan has finished running, you will see a “Tests” tab on the page, which you can click through and see details of every test.
