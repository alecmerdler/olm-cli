const inquirer = require('inquirer');
const yaml = require('js-yaml');
const ora = require('ora');
const { execSync } = require('child_process');

// FIXME(alecmerdler): Accept namespace argument
const targetNamespace = 'olm-dev';

// FIXME(alecmerdler): Use `fetch` with kubeconfig instead of shelling out to `kubectl`
const packages = yaml.safeLoad(execSync(`kubectl get packagemanifests -n ${targetNamespace} -o json`));

const subscriptionFor = (pkg) => {
  return {
    apiVersion: 'operators.coreos.com/v1alpha1',
    kind: 'Subscription', 
    metadata: {
      name: `install-${pkg.metadata.name}`,
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

    const pkg = packages.items.find(pkg => pkg.status.channels[0].currentCSVDesc.displayName === answers.package);
    if (answers.confirm) {
      const sub = subscriptionFor(pkg);

      const spinner = ora('Creating Operator subscription...').start();
      new Promise(resolve => {
        setTimeout(() => {
          execSync(`echo '${JSON.stringify(sub)}' | kubectl create -n ${targetNamespace} -f -`);
          resolve();
        }, 3000);
      }).then(() => new Promise(resolve => {
        spinner.text = 'Installing Operator...';
        spinner.color = 'white';
        setTimeout(() => resolve(), 3000);
      })).then(() => new Promise(resolve => {
        spinner.text = 'Making you wait for no reason...';
        spinner.color = 'gray';
        setTimeout(() => resolve(), 10000);
      })).then(() => {
        spinner.succeed('Operator installed!');
      }).then(() => new Promise(resolve => {
        // setTimeout(() => resolve(), 15000);
        // FIXME(alecmerdler): Cleanup for testing
        // execSync(`kubectl delete subscription -n ${targetNamespace} ${sub.metadata.name}`);
        // execSync(`kubectl delete clusterserviceversion -n ${targetNamespace} ${pkg.status.channels[0].currentCSV}`);
        // console.log('Operator uninstalled!');
      }));      
    } else {
      console.log('No soup for you!');
    }
  });
