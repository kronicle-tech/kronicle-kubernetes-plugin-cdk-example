import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';

export class EksExampleStack extends cdk.Stack {
  private vpc: ec2.IVpc;
  private eksCluster: eks.Cluster;

  constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
    super(app, id, props);

    this.createVpc();
    this.createEksCluster();
    this.grantEksClusterAccess();
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
      clusterName: 'example-eks',
      vpcSubnets: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          onePerAz: true,
        }
      ],
      defaultCapacity: 1,
      defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      endpointAccess: eks.EndpointAccess.PUBLIC_AND_PRIVATE,
    });
    const kronicleServiceSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'KronicleServiceSecurityGroup', 'sg-0883304a22bc5c867');
    this.eksCluster.clusterSecurityGroup.addIngressRule(kronicleServiceSecurityGroup, ec2.Port.tcp(443));
  }

  private grantEksClusterAccess() {
    this.eksCluster.addManifest('ApiReadOnlyClusterRole', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'api-read-only',
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['get', 'list'],
        }
      ]
    });
    this.eksCluster.addManifest('ApiReadOnlyRoleBinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'api-read-only-binding',
      },
      subjects: [
        {
          kind: 'User',
          name: 'kronicle-service',
          apiGroup: 'rbac.authorization.k8s.io',
        },
      ],
      roleRef: {
        kind: 'ClusterRole',
        name: 'api-read-only',
        apiGroup: 'rbac.authorization.k8s.io',
      }
    });
    const awsAuth = new eks.AwsAuth(this, 'EksClusterAwsAuth', {
      cluster: this.eksCluster,
    });
    awsAuth.addAccount(this.account);
    const kronicleServiceRoleName = 'KronicleStack-KronicleTaskDefinitionTaskRoleCBE6C8-1HLFM69DYGCG6';
    const kronicleServiceRole = iam.Role.fromRoleName(this, 'KronicleServiceRole', kronicleServiceRoleName);
    awsAuth.addRoleMapping(kronicleServiceRole, {
      username: 'kronicle-service',
      groups: ['api-read-only'],
    })
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
