const core = require('@actions/core');
const exec = require("@actions/exec");
const github = require('@actions/github');
const octokit = github.getOctokit(core.getInput('github-token'))

const mapBuildArgs = (buildArgs) => buildArgs?.map((arg) => `--build-arg ${arg}`).join(' ') || '';

const mapPlatform = (platform) => platform ? `--platform ${platform}` : '';

const mapNoCache = (noCache) => noCache ? '--no-cache' : '';

const mapExecWithSudo = (execWithSudo) => execWithSudo ? 'sudo ' : '';

const build = async function (dockerFile, imageName, tag, buildPath, buildArgs, platform, noCache, execWithSudo) {
  await exec.exec(`${mapExecWithSudo(execWithSudo)}docker build -t ${imageName}:${tag} ${mapPlatform(platform)} ${mapNoCache(noCache)} ${mapBuildArgs(buildArgs)} -f ${dockerFile} ${buildPath}`);
}

const publish = async function (imageName, tag, execWithSudo) {
  await exec.exec(`${mapExecWithSudo(execWithSudo)}docker push ${imageName}:${tag}`);
}

const clean = async function (owner, packageName) {
  const response = await octokit.request(`GET /orgs/${owner}/packages/container/${packageName}/versions`, { per_page: 100 });

  for (version of response.data) {
    if (version.metadata.container.tags.length == 0) {
      console.log("Deleting " + version.id);
      const deleteResponse = await octokit.request(`DELETE /orgs/${owner}/packages/container/${packageName}/versions/${version.id}`, {});
      console.log("Deletion " + deleteResponse.status);
    }
  }
}

const deleteTag = async function (owner, packageName, tag) {
  const response = await octokit.request(`GET /orgs/${owner}/packages/container/${packageName}/versions`, { per_page: 100 });

  for (version of response.data) {
    if (version.metadata.container.tags.includes(tag)) {
      console.log("Deleting tag " + tag);
      const deleteResponse = await github.request(`DELETE /orgs/${owner}/packages/container/${packageName}/versions/${version.id}`, {});
      console.log("Deletion " + deleteResponse.status);
    }
  }
}

const deleteImage = async function (imageName, tag) {
  await exec.exec(`docker image rm ${imageName}:${tag}`);
}

const run = async function () {
  try {
    const wantsBuild = core.getBooleanInput('build');
    const packageName = core.getInput('package-name');
    const owner = core.getInput('owner');
    const dockerFile = core.getInput('docker-file');
    const buildPath = core.getInput('build-path');
    const wantsPublish = core.getBooleanInput('publish');
    const wantsClean = core.getBooleanInput('clean');
    const wantsDeleteTag = core.getBooleanInput('delete-tag');
    const wantsDeleteImage = core.getBooleanInput('delete-image');
    const tag = core.getInput('tag');
    const imageName = 'ghcr.io/' + owner.toLowerCase() + '/' + packageName;
    const buildArgs = core.getMultilineInput('build-args');
    const platform = core.getInput('platform');
    const noCache = core.getBooleanInput('no-cache');
    const execWithSudo = core.getBooleanInput('exec-with-sudo', { required: false });

    console.log(`Preparing for ${packageName}:${tag}...`)

    if (wantsBuild) {

      console.log(`Building ${packageName}:${tag}...`)
      await build(dockerFile, imageName, tag, buildPath, buildArgs, platform, noCache, execWithSudo);
    }

    if (wantsPublish) {
      console.log(`Publishing ${packageName}:${tag}...`)
      await publish(imageName, tag, execWithSudo);
    }

    if (wantsClean) {
      console.log(`Deleting old ${packageName} images...`)
      await clean(owner, packageName);
    }

    if (wantsDeleteTag) {
      console.log(`Deleting tag ${packageName}:${tag}...`)
      await deleteTag(owner, imageName, tag);
    }

    if (wantsDeleteImage) {
      console.log('Deleting image');
      await deleteImage(imageName, tag);
    }

    console.log('Done');

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();