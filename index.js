const inquirer = require('inquirer');
const fetch = require('node-fetch');
const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

// FIXME(alecmerdler): Use `fetch` with kubeconfig instead of shelling out to `kubectl`
// FIXME(alecmerdler): Accept namespace argument
const packages = yaml.safeLoad(execSync(`kubectl get packagemanifests -n default -o json`));

const subscriptionFor = (pkg) => {
  return {
    apiVersion: 'operators.coreos.com/v1alpha1',
    kind: 'Subscription', 
    metadata: {
      name: `install-${pkg.metadata.name}`,
      labels: {
        'olm-cli': true,
      },
    },
    spec: {
      channel: pkg.status.channels[0].name,
      installPlanApproval: 'Automatic',
      name: pkg.status.packageName,
      source: pkg.status.catalogSource,
      sourceNamespace: pkg.status.catalogSourceNamespace,
      startingCSV: pkg.status.channels[0].currentCSV,
    }
  }
}

inquirer
  .prompt([
    {
      type: 'list',
      name: 'theme',
      message: 'What do you want to do?',
      choices: [
        'List available Operator packages',
        'Install an Operator package',
        new inquirer.Separator(),
        {
          name: 'Complain about OpenShift',
          disabled: 'Unavailable at this time'
        },
      ]
    },
    {
      type: 'list',
      name: 'package',
      message: 'Which Operator do you want to install?',
      choices: packages.items.map(pkg => pkg.status.channels[0].currentCSVDesc.displayName),
      pageSize: 100,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Install this Operator?',
      default: 'Y',
    }
  ])
  .then(answers => {
    console.log(`====================
${JSON.stringify(answers, null, '  ')}
====================`);

    const pkg = packages.items.find(pkg => pkg.metadata.name === answers.package);
    if (answers.confirm) {
      // TODO(alecmerdler): Create subscription
      const sub = subscriptionFor(pkg);
      console.log(sub);
    } else {
      // TODO(alecmerdler): Sad panda message...
    }
  });
