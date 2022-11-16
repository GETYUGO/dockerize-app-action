const core = require('@actions/core');
const exec = require("@actions/exec");
const github = require('@actions/github');
const octokit = github.getOctokit(core.getInput('github-token'))

const build = async function(dockerFile, imageName, tag, buildPath) {
  await exec.exec(`docker build -t ${imageName}:${tag} -f ${dockerFile} ${buildPath}`);
}

const publish = async function(imageName, tag) {
  await exec.exec(`docker push ${imageName}:${tag}`);
}

const clean = async function(owner, packageName) {
  const response = await octokit.request(`GET /orgs/${owner}/packages/container/${packageName}/versions`,
    { per_page: 100 });

  for(version of response.data) {
      if (version.metadata.container.tags.length == 0) {
          console.log("Deleting " + version.id)
          const deleteResponse = await octokit.request(`DELETE /orgs/${owner}/packages/container/${packageName}/versions/${version.id}`, { });
          console.log("Deletion " + deleteResponse.status)
      }
  }
}

const run = async function() { 
  try {
    const wantsBuild = core.getBooleanInput('build');
    const packageName = core.getInput('package-name');
    const owner = core.getInput('owner');
    const dockerFile = core.getInput('docker-file');
    const buildPath = core.getInput('build-path');
    const wantsPublish = core.getBooleanInput('publish');
    const wantsClean = core.getBooleanInput('clean');
    const tag = core.getInput('tag');
    const imageName = 'ghcr.io/' + owner.toLowerCase() + '/' + packageName;
  
    if (wantsBuild) {
      console.log(`Building ${imageName}:${tag}...`)
      await build(dockerFile, imageName, tag, buildPath);
    }
  
    if (wantsPublish) {
      console.log(`Publishing ${imageName}:${tag}...`)
      await publish(imageName, tag);
    }
  
    if (wantsClean) {
      console.log(`Deleting old ${imageName} images...`)
      await clean(owner, packageName);
    }

    console.log('Done');
  
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();