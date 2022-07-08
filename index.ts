import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';

export class EksExampleStack extends cdk.Stack {
  private vpc: ec2.IVpc;
  private eksCluster: eks.Cluster;

  constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
    super(app, id, props);

    this.createVpc();
    this.createEksCluster();
    this.applyHelmChart();
  }

  private createVpc() {
    this.vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcName: "kronicle",
    });
  }

  private createEksCluster() {
    this.eksCluster = new eks.Cluster(this, 'EksCluster', {
      vpc: this.vpc,
      version: eks.KubernetesVersion.V1_21,
      clusterName: 'kronicle-kubernetes-plugin-example',
      vpcSubnets: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          onePerAz: true,
        }
      ],
      defaultCapacity: 1,
      defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
    });
  }

  private applyHelmChart() {
    this.eksCluster.addHelmChart('ArgoCd', {
      chart: 'argo-cd',
      version: '4.9.8',
      repository: 'https://argoproj.github.io/argo-helm',
      release: 'arco-cd'
    });
  }
}

const app = new cdk.App();
new EksExampleStack(app, 'EksExample', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
cdk.Tags.of(app).add('team', 'kronicle-project');
cdk.Tags.of(app).add('component', 'kronicle-kubernetes-plugin-example');
cdk.Tags.of(app).add('example', 'true');
app.synth();
