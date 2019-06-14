const inquirer = require('inquirer');
const yaml = require('js-yaml');
const ora = require('ora');
const { execSync } = require('child_process');

// FIXME(alecmerdler): Accept namespace argument
const targetNamespace = 'olm-dev';

// FIXME(alecmerdler): Use `fetch` with kubeconfig instead of shelling out to `kubectl`
const packages = yaml.safeLoad(execSync(`kubectl get packagemanifests -n ${targetNamespace} -o json`));
const subscriptions = yaml.safeLoad(execSync(`kubectl get subscriptions -n ${targetNamespace} -o json`));

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
};

inquirer
  .prompt([
    {
      type: 'list',
      name: 'theme',
      message: 'What do you want to do?',
      choices: [
        {name: 'List available Operator packages', value: 'listPackages'},
        {name: 'Install an Operator package', value: 'installPackage'},
        new inquirer.Separator(),
        {name: 'Complain about OpenShift', disabled: 'Unavailable at this time'},
      ]
    }
  ])
  .then(answers => {
    if (answers.theme === 'listPackages') {
      packages.items.forEach(pkg => console.log(`${pkg.status.channels[0].currentCSVDesc.displayName}`));
    } else if (answers.theme === 'installPackage') {
      inquirer
        .prompt([
          {
            type: 'list',
            name: 'package',
            message: 'Which Operator do you want to install?',
            choices: packages.items.map(pkg => ({
              name: pkg.status.channels[0].currentCSVDesc.displayName,
              disabled: subscriptions.items.some(sub => sub.spec.name === pkg.status.packageName),
            })),
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
          const pkg = packages.items.find(pkg => pkg.status.channels[0].currentCSVDesc.displayName === answers.package);
          if (answers.confirm) {
            const sub = subscriptionFor(pkg);
      
            const spinner = ora('Creating Operator subscription...').start();
            new Promise(resolve => {
              setTimeout(() => {
                execSync(`echo '${JSON.stringify(sub)}' | kubectl create -n ${targetNamespace} -f -`);
                resolve();
              }, 2000);
            }).then(() => new Promise(resolve => {
              spinner.text = 'Installing Operator...';
              spinner.color = 'white';
              setTimeout(() => resolve(), 2000);
            })).then(() => new Promise(resolve => {
              spinner.text = 'Making you wait for no reason...';
              spinner.color = 'gray';
              setTimeout(() => resolve(), 10000);
            })).then(() => new Promise(resolve => {
              spinner.text = 'Finishing up...';
              spinner.color = 'cyan';
              setTimeout(() => resolve(), 2000);
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
        })
    } else {
      console.error(`Invalid option!`);
    }
  });
