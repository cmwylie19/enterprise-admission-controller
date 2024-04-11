# Optimizing Kubernetes Operators and Admission Control with Pepr

The format to run this workshop is phase by phase, moving on after each activity is complete. The markdown has a [corresponding repo](https://github.com/cmwylie19/enterprise-admission-controller.git) where each phase has a corresponding branch. If you ever get stuck you can peek at the repo at the corresponding branch.  

### TOC
- [Background](#background)
- [Phase 1 - Get to know Hello Pepr](#phase-1)
- [Activity 1 - Run Hello Pepr](#activity-1)
- [Phase 2 - Validating security posture](#phase-2)
- [Activity 2 - No privileged pods](#activity-2)
- [Phase 3 - Mutating security posture](#phase-3)
- [Activity 3 - Standardized security contexts](#activity-3)
- [Phase 4 - Programming organizational knowledge](#phase-4)
- [Activity 4 - When there is static, slap the TV](#activity-4)
- [Phase 5 - Operator for repeatable deployments](#phase-5)
- [Activity 5 - Deploying a webapp](#activity-5)
- [Phase 6 - Building Kubernetes manifests](#phase-6)
- [Activity 6 - Deploy from kubectl](#activity-6)
- [Phase 7 - What's next?](#phase-7)
## Prereqs

- Mac or Linux
- Node.js v18.0.0+ (even-numbered releases only)
- npm v10.1.0+
- Visual Studio Code for inline debugging and Pepr Capabilities creation.
- [k3d](https://k3d.io/v5.6.0/) - A Kubernetes cluster for npx pepr dev. Pepr modules include npm run k3d-setup if you want to test locally with K3d and Docker.
- `kubectl`
- [jq](https://jqlang.github.io/jq/) 

### Background 

You are the Chief Architect at Big Enterprise Co which maintains over 200 production apps from different teams. You are overseeing an effort to migrate all apps to a new multi-cloud HA Kubernetes cluster. 

It is your job to ensure: 
- All 200 Apps are migrated
- Apps meet security requirements
- The teams are able to quickly release patches and updates

Big Enterprise Co maintains strict standards across the board and does not make exceptions for any team. The teams have different levels of experience in Kubernetes. In order to enforce standarization, you decide to create an Admission Controller so that all resources entering the cluster are validated and mutated to meet the standards.

After researching potential Admission Controllers, you decide to use [Pepr](https://github.com/defenseunicorns/pepr) because:
- It is fully open source
- It allows the creation of Policy to dictate what can enter a Kubernetes Cluster, similar to Kyverno and OPA Gatekeeper
- It has a Kubernetes Watch Mechanism, similar to Operator-SDK and Kube-Builder, allowing you to write full Kubernetes native applications to simplify advanced configuration
- It is lightweight and developer friendly with a simple, easy to use, API and comes with IntelliSense out of the box
- It comes with an intuitive [Kubernetes Client](https://github.com/defenseunicorns/kubernetes-fluent-client) that uses [Server Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) as a more efficient means to speak to the Kube-APIServer.

## Phase 1

The first order of business is to create the scaffolding for your Admission Controller, call it `enterprise-admission-controller`. 

Initialize a new Pepr module. "Module" is what we call a project in Pepr.

```bash
npx pepr init
```

You will be asked for a description for the module and what to do in the event of a failure.  The description will be an `annotation` on the controller's deployments. The event failure will be used in the Webhook's [failurePolicy](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#failure-policy).

```plaintext
✔ Enter a name for the new Pepr module. This will create a new directory based on the name.
 … enterprise-admission-controller
✔ (Recommended) Enter a description for the new Pepr module.
 … DevopsDaysRaleigh 2024
✔ How do you want Pepr to handle errors encountered during K8s operations? › Reject the operation

  To be generated:

    enterprise-admission-controller
    ├── .eslintrc.json
    ├── .gitignore
    ├── .prettierrc
    ├── capabilties
    │   ├── hello-pepr.samples.yaml     
    │   └── hello-pepr.ts     
    ├── package.json
    │   {
    │     name: 'enterprise-admission-controller',
    │     version: '0.0.1',
    │     description: 'DevopsDaysRaleigh 2024',
    │     keywords: [ 'pepr', 'k8s', 'policy-engine', 'pepr-module', 'security' ],
    │     engines: { node: '>=18.0.0' },
    │     pepr: {
    │       uuid: 'c8219d66-6901-5ef5-bcd5-6bb66f6afbb7',
    │       onError: 'reject',
    │       webhookTimeout: 10,
    │       customLabels: { namespace: { 'pepr.dev': '' } },
    │       alwaysIgnore: { namespaces: [] },
    │       includedFiles: [],
    │       env: {}
    │     },
    │     scripts: {
    │       'k3d-setup': "k3d cluster delete pepr-dev && k3d cluster create pepr-dev --k3s-arg '--debug@server:0' --wait && kubectl rollout status deployment -n kube-system"
    │     },
    │     dependencies: { pepr: '0.28.7' },
    │     devDependencies: { typescript: '5.3.3' }
    │   }
    ├── pepr.ts
    ├── README.md
    └── tsconfig.json
      
? Create the new Pepr module? › (y/N)
```

A new VSCode project will pop up. Run `npm i` to install the modules, then spend a few moments looking over `capabilities/hello-pepr.ts` to try and get an idea how Pepr works.

Notice how you are able to to Mutate, Validate, and Watch a Kubernetes Object.

The general format for each "binding" is:

```plaintext
When(a.<KubernetesObject>)
.<event>(IsCreated/IsUpdated/IsCreatedOrUpdated/IsDeleted)
.<filters>(WithName/WithLabel/WithAnnotation/InNamespace)
.<callback>(Mutate/Validate/Watch/Reconcile)
```

For example:

```plaintext
When(a.Namespace)
  .IsCreated()
  .WithAnnotation("DevopsDaysRaleigh 2024")
  .Mutate(ns => ns.RemoveLabel("remove-me"));
```

Next, create our dev cluster by running: `npm run k3d-setup`.

#### Activity 1

Open a `JavaScript Debug Terminal` in VSCode:

![image](https://github.com/cmwylie19/enterprise-admission-controller/assets/1096507/7d4ffbc6-0e81-4b1d-b06f-53a257b1cae0)

Inside of the debug terminal run:

```bash
npx pepr dev --confirm
```

The debug terminal will be used to look at logs during Activity 1.

Wait until you see a log like `[xx:xx:xx.xxx] INFO (xxxxx): ✅ Scheduling processed`. This indicates that the module is ready.

Next, open a second terminal beside the debug terminal. We'll use this new terminal to create the namespace `pepr-demo`.

On line 38 of `capabilites/hello-pepr.ts` we see that inside the Mutate callback there is a `RemoveLabel("remove-me")`. Create a namespace with that label and test that it properly Mutates the `remove-me` label:

```yaml
kubectl apply -f -<<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: pepr-demo
  labels:
    keep-me: please
    remove-me: right-now
EOF
```

By checking the labels we see that Pepr mutated the remove-me label: 

```bash
kubectl get ns pepr-demo --show-labels
```

Output confirming that the `remove-me` label has been removed and only the `keep-me` label remains:

```plaintext
NAME        STATUS   AGE   LABELS
pepr-demo   Active   6s    keep-me=please,kubernetes.io/metadata.name=pepr-demo
```

Next, on line 157 of `capabilites/hello-pepr.ts` there is a Validate that should reject any ConfigMap created with annotation `evil`. To test this, create a ConfigMap in `pepr-demo` with an `evil` annotation:

```yaml
kubectl apply -f -<<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: example-evil-cm
  namespace: pepr-demo
  annotations:
    evil: 'true'
data:
  key: ex-evil-cm-val
EOF
```

In the output we see that the validating webhook rejected the ConfigMap:

```plaintext
Error from server: error when creating "STDIN": admission webhook "pepr-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.pepr.dev" denied the request: No evil CM annotations allowed.
```

Finally, let's see how `Watch` works. 

On line 51 of `capabilites/hello-pepr.ts` change `.WithName("pepr-demo-2")` to `.WithName("pepr-demo")` and on line 53 change `Log.info("Namespace pepr-demo-2 was created.");` to `Log.info("Namespace pepr-demo was updated again.");`. On line 60 change `pepr-demo-2` to `pepr-demo` and save.

Lines 49-73 should look like:
```ts
When(a.Namespace)
  .IsCreatedOrUpdated()
  .WithName("pepr-demo")
  .Watch(async ns => {
    Log.info("Namespace pepr-demo was updated again.");

    try {
      // Apply the ConfigMap using K8s server-side apply
      await K8s(kind.ConfigMap).Apply({
        metadata: {
          name: "pepr-ssa-demo",
          namespace: "pepr-demo",
        },
        data: {
          "ns-uid": ns.metadata.uid,
        },
      });
    } catch (error) {
      // You can use the Log object to log messages to the Pepr controller pod
      Log.error(error, "Failed to apply ConfigMap using server-side apply.");
    }

    // You can share data between actions using the Store, including between different types of actions
    Store.setItem("watch-data", "This data was stored by a Watch Action.");
  });
```

Now update the `pepr-demo` namespace while looking at logs in the debug terminal:

```bash
kubectl label ns pepr-demo hello=devopsdaysraleigh
```

You should see a log with level INFO that looks like:

```plaintext
[xx:xx:xx.xxx] INFO (xxxxx): Namespace pepr-demo was updated again
```

There also should be a new configMap created in `pepr-demo` named `pepr-ssa-demo`. You can confirm this with:

```yaml
kubectl get cm -n pepr-demo pepr-ssa-demo -oyaml
```

The output will be similar to:

```plaintext
apiVersion: v1
data:
  ns-uid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
kind: ConfigMap
metadata:
  name: pepr-ssa-demo
  namespace: pepr-demo
  uid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```  

This confirms the Kubernetes Fluent Client created a resource when Pepr received the `Watch` event from the Kubernetes API Server.

_Sometimes Watch is a better option than Mutate or Validate because it is not affected by [WebHook Timeouts](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#failure-policy) because it is a call to the Kube-Api Server and not an Admission Phase. However, it does require additional RBAC to Watch resources. This additional RBAC is not needed when using Mutate or Validate which are Admission Phases._

Before moving on, play with the IntelliSense. Starting: 

```plaintext
When(a.<notice_intellisense>).<notice_intellisense>.<notice_intellisense>
```

Developer experience is a first class citizen in Pepr and it will help you move more quickly from prototype to MVP.

Anytime you make changes or want to format your code use:

```bash
npx pepr format
```

This will tree-shake your code, ensuring your module is as small as possible.

## Phase 2

Big Enterprise Co was exploited when a hacker reversed shelled out of an over privileged container and sensitive data was stolen from the nodes. In response, the company has created a zero tolerance policy on privileged containers. 

#### Activity 2

Create an action to enforce the new security standard that containers running as privileged are not allowed to enter the cluster.

Hints:
1. Copy `capability/hello-pepr.ts` to `capability/admission.ts`
2. Rename the HelloPepr Capability to the Admission Capability
3. Remove the HelloPepr actions and create a new action for When a Pod is created or updated
4. Set the capability namespaces to `namespaces: []` so that the policy applies to all namespaces
5. Use the helper function `containers` from `pepr`. It is in an sdk object. to return all containers on a pod
6. Update `pepr.ts` to point to `admission.ts`
7. Look back in `hello-pepr.ts` to see how the validates work and review the [Validate Docs](https://docs.pepr.dev/main/user-guide/actions/#validate)

You can compare your new Admission Capability to our solution:

```ts
import { sdk } from "pepr"

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { containers } = sdk;
const { When } = Admission;

When(a.Pod)
.IsCreatedOrUpdated()
.Validate(po => {
    // Now traverse the list of containers to check the securityContexts
    let podContainers = containers(po);
})
```

_Confirm Correctness_

To condirm your module correctly rejects privileged pods:
1. Refresh your cluster: `npm run k3d-setup`
2. Format the module using `npx pepr format` 
3. Run the module using `npx pepr dev --confirm`
4. Apply test resources using:  

```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-2
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: double-privileged-po
  name: double-privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: double-privileged-po
    securityContext:
      privileged: true
      allowPrivilegeEscalation: true
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: privileged-po
  name: privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: privileged-po
    securityContext:
      privileged: true
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: escalated-privileged-po
  name: escalated-privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: escalated-privileged-po
    securityContext:
      allowPrivilegeEscalation: true
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: unprivileged-po
  name: unprivileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: unprivileged-po
    securityContext: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: root-user-pod
  name: root-user-pod
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: root-user-pod
    securityContext:
      runAsUser: 0
EOF
```

5. Check the correctness of the pods admitted into the cluster:
    
```bash
kubectl get po -n phase-2 --no-headers -o custom-columns=NAME:.metadata.name
```

The expected output is:

```plaintext
unprivileged-po
root-user-pod
```

If you got the expected output, you win! Go on to Phase 3. **DO NOT DELETE YOUR CLUSTER**


## Phase 3 

Big Enterprise Co has started to enhance its security posture. Your bosses are pleased, but you can't help noticing that the Pod and Container securityContexts are all over the map. Some pods are running as user 0 (which is a problem), some are running as user 655532, and some are running as user 1000. There is no standardization.  

Our goal is to standardize the `runAsUser` securityContext for pods and containers.
- If the pod/container do not have a securityContext `runAsUser`, create one
- If the pod/container has a securityContext `runAsUser` set to 0, override it

#### Activity 3

Create a new action to Mutate pods (and the containers of said pods) to have a default runAsUser value:
- If no runAsUser value exists - assign 655532
- If a runAsUser value exists:
  - If set 0 - 10, then override the value to set it to 1000
- If a pod has the label `ignore-me`, then **DO NOT MUTATE**!

**IMPORTANT** When the container user changes, it can lead to problems creating files and mounting volumes which breaks some applications. We need an escape clause. _You will need this for the operator activity that is later in this workshop._

Hints:
1. Add a new Mutate action to the `capability/admission.ts` you created in Activity 2
2. Remember that pods and containers both have `securityContext.runAsUser`
3. You need to consider that there could be containers, initContainers, and ephemeralContainers
4. Use the containers function from `pepr` to see if you need to update any containers
5. Create a `containerHelper` helper to re-use code
6. You may find it helpful to review the [Mutate Docs](https://docs.pepr.dev/main/user-guide/actions/#mutate)

You can compare your updated Admission Capability to our solution:

```ts
import { sdk } from "pepr"
// V1Container is the container type for the helper
import { V1Container } from "@kubernetes/client-node";

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { containers } = sdk;
const { When } = Admission;

// existing
When(a.Pod)
.IsCreatedOrUpdated()
.Validate(po => {})

// new
const containerHelper = (container: V1Container) => {...}
When(a.Pod)
.IsCreatedOrUpdated()
.Mutate(po => {})
``` 

_Check Correctness_

To check if your module correctly rejects privileged pods:
1. Format the module using `npx pepr format` 
2. Run the module using `npx pepr dev --confirm`
2. Apply test resources using: 

```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-3
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: po
    ignore-me: sure
  name: ignore-me
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: ubuntu
    command: ["sh", "-c", "sleep 3600"]
    name: po
    securityContext:
      runAsUser: 5
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: mutate-pod
  name: mutate-pod-leave-container
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: ubuntu
    command: ["sh", "-c", "sleep 3600"]
    name: mutate-pod
    securityContext:
      runAsUser: 5555
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: mutate-pod
  name: mutate-pod-mutate-container
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: ubuntu
    name: mutate-pod
    command: ["sh", "-c", "sleep 3600"]
    securityContext:
      runAsUser: 5
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: mutate-to-default
  name: mutate-to-default
  namespace: phase-3
spec:
  containers:
  - image: ubuntu
    name: mutate-to-default
    command: ["sh", "-c", "sleep 3600"]
    resources: {}
EOF
```

4. Check the correctness of the mutated pods:

- The ignore-me pod should have not been mutated because has the `ignore-me` label). Both runAsUser securityContexts should be 5.  

```bash
kubectl get po ignore-me -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
5                    5
```

- The mutate-pod-leave-container pod should have mutated only the pod and not the container  

```bash
kubectl get po mutate-pod-leave-container -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
1000                 5555
```

- The mutate-pod-mutate-container pod should have mutated both the pod and the container. The securityContexts should have been mutated to 1000 since they were set at 5.

```bash
kubectl get po mutate-pod-mutate-container -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
1000                 1000
```

- The mutate-to-defaults pod should have mutated both the pod and the container to 1000 since no securityContexts were set.

```bash
kubectl get po mutate-to-default -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
655532               655532
```

If you got the expected output, you win! Go on to Phase 4. **DO NOT DELETE YOUR CLUSTER**


## Phase 4

Pepr features a full featured Store and Schedule. Back in [Phase 3](#phase-3) we were applying default runAsUser securityContexts but we ignored pods with label `ignore-me`. Big Enterprise Co wants to run a job that reports every 10 seconds the last app that uses the ignore label. You were thinking about using a Kubernetes native CronJob, but you realize with Pepr's Store and Schedule you can do this all in one place.

#### Activity 4

_This activity focuses on learning to use Pepr's Store and Schedule._

We need to update `capability/admission.ts` to store the last pod that has the label `ignore-me` and then create a schedule that runs every 10 seconds to check the store for the last pod that has the label `ignore-me`.

Hints:
- Update the Mutate action that is looking for pods that were CreatedOrUpdated, if the pod has label "ignore-me", set the pod in the store with `Store.setItem("last-ignore-me", po.Raw.metadata.name);`
- Create an OnSchedule that gets the item from the store "last-ignore-me" and does a Log.info("Last ignored pod was xxx") and then sets another item in the store "pass" to "{name-of-pod}".
- You may find it helpful to review the [OnSchedule Docs](https://docs.pepr.dev/main/user-guide/onschedule/)
- You may find it helpful to review the [Store Docs](https://docs.pepr.dev/main/user-guide/store/)
- Make sure you run Pepr with PEPR_WATCH_MODE=true in order to use the schedule `PEPR_WATCH_MODE="true"  npx pepr dev --confirm`  

You can compare your updated `capability/admission.ts` to our solution:

```ts
const { When, Store, OnSchedule } = Admission;

OnSchedule({
  name: "...",
  every: ?,
  unit: "seconds",
  run:  () => {...},
});

When(a.Pod)
  .IsCreatedOrUpdated()
  .Mutate(po => {
    if (!po.HasLabel("ignore-me")) {

    } else {
      ....
    }
```

_Check Correctness_

```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-4
spec: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: legacy-app
    alert: critical
    ignore-me: sure
  name: legacy-app
  namespace: phase-4
spec:
  containers:
  - image: nginx
    name: legacy-app
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
EOF
sleep 20
kubectl get peprstore -n pepr-system -oyaml | grep pass
```

**expected output**

```plaintext
    Admission-pass: legacy-app
```

## Phase 5

Congrats! So far 199/200 apps are onboarded. Unfortunately, the last app team has no Kubernetes experience and the team members are having a difficult time creating repeatable deployments. "Heroics" are involved every time they need to do a release. After seeing the team pull all-nighters, you decide to build an operator to help deploy the app. Because Pepr natively speaks to the Kubernetes Watch API and has a reconcile callback that processes events in a Queue guaranteeing ordered and synchronous processing of events, an operator will allow for consistent, repeatable deployments even when the system may be under heavy load.

The App that you'll be creating a controller for is a webapp that has 3 major configuration options:
1. Language - English, Spanish
2. Theme - Dark, Light
3. Replicas - 1-7

Your job is to consolidate this down to one resource so that the team can focus more on building the app and less on the deployment specifics.

#### Activity 5

Create an Operator in Pepr that reconciles on a WebApp resource. 

When the Operator is deployed:
- The WebApp CRD Should be Created
- If the WebApp CRD is deleted, it should be auto created again
- If a resource needed by the WebApp is deleted, it should be auto created (Deployment, Service, ConfigMap)
- If the WebApp instance is deleted, then the owned resources should also be deleted

Hints:
1. You may find it helpful to review the [Operator Tutorial](https://docs.pepr.dev/main/pepr-tutorials/create-pepr-operator/)
2. You may find it helpful to review the [Excellent Example Operator](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/pepr-operator)
3. Run your pepr module with `npx pepr dev --confirm` in one terminal.

_Check Correctness_

1. Make sure the WebApp CRD was deployed by the Controller

```bash
kubectl get crd webapps.pepr.io --no-headers
```

**expected output**

```bash
webapps.pepr.io   2024-04-08T16:29:29Z
```

2. Deploy a webapp instance and check to see if a `ConfigMap` with Spanish, a `Service`, and a `Deployment` are created

```yaml
kubectl create ns webapps;
kubectl apply -f -<<EOF
kind: WebApp
apiVersion: pepr.io/v1alpha1
metadata:
  name: webapp-light-en
  namespace: webapps
spec:
  theme: light 
  language: en
  replicas: 1 
EOF
```

The webapp instance should have a `ConfigMap`, `Service`, and `Deployment` called webapp-light-en:

```bash
kubectl get svc,deploy,cm -n webapps --no-headers
```

**expected output**

```bash
service/webapp-light-en   ClusterIP   10.43.173.219   <none>   80/TCP   16s
deployment.apps/webapp-light-en   1/1   1     1     16s
configmap/kube-root-ca.crt              1     17s
configmap/web-content-webapp-light-en   1     16s
┌─[cmwylie19@Cases-MacBook-Pro] - [~/enterprise-adm
```

3. Expect all replicas to be available:

```bash
kubectl get deploy -n webapps webapp-light-en --template="{{.status.availableReplicas}}"
```

**expected output**
```bash
1
```

4. If you delete a WebApp owned resource, it is auto created:

```bash
kubectl delete cm --all -n webapps
kubectl get cm -n webapps
```

**expected output**

```bash
NAME                          DATA   AGE
kube-root-ca.crt              1      0s
web-content-webapp-light-en   1      0s
```

5. Expect that if you delete the WebApp Resource, the owned resources will have a cascading deletion:

```bash
kubectl delete webapps -n webapps --all

# wait several seconds
sleep 10
kubectl get cm,deploy,svc -n webapps
```

**expected output**

```bash
NAME                         DATA   AGE
configmap/kube-root-ca.crt   1      105s
```

Feel free to ask questions if you missed anything.

## Phase 6

Big Enterprise Co has a GitOps workflow. You need to generate the Kubernetes manifests for your project. To build your code you can run `npx pepr build`.

In our case, we need to extend the WebHook timeout because our Operator needs to be deleted from the Store BEFORE it is deleted from the Kubernetes cluster. Sometimes it can take several seconds for something to be deleted from the store so it is safer to extend the timeout.

To build your code and extend the timeout:

```bash
npx pepr build --timeout=25
```

To make sure that the Operator is deleted from the Store before it is deleted from the Kubernetes cluster, you can update your code to include:

```ts
When(WebApp)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata.name);
  });

When(a.ConfigMap)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async cm => {
    const instance = JSON.parse(
      Store.getItem(cm.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
```

Another alternative we have is to deploy our Controller with rbac-mode scoped down to least privileged:

```bash
npx pepr build --rbac-mode=scoped
```

Remember, Mutating and Validating require zero permissions, but Watch and Reconcile do. Running the build with `rbac-mode=scoped` will generate enough RBAC for you to watch the resources but if you are CREATING, READING, UPDATING, DELETING resources yourself, in terms of calls to the Kube-APIServer, you will need add that to the cluster role. By default, the service account will have cluster admin and will be able to do ANY API CALL! For prod, it is recommended to scope it down to the least privilege possible.  

#### Activity 6

Recreate the cluster and deploy with rbac mode scoped and the webhook timeout set to 25 seconds

Hints:
- You may find it helpful to review the [RBAC Docs](https://docs.pepr.dev/main/user-guide/rbac/)
- You may find it helpful to review the [Build Docs](https://docs.pepr.dev/main/user-guide/pepr-cli/#npx-pepr-build)

You can deploy with rbac mode scoped and the webhoot timeout set to 25 seconds using:

```bash
npx pepr build --rbac-mode=scoped --timeout=25
```

_Check Correctness_

First, get your module up and running:

```bash
kubectl apply -f dist/pepr-module*.yaml
kubectl wait --for=condition=ready pod -l app -n 
pepr-system
```

**Expected outputs:**

Admission Controller Pods Ready

```bash
kubectl get deploy -n pepr-system -l pepr.dev/controller=admission 
NAME                                                READY   UP-TO-DATE   AVAILABLE   AGE
pepr-c8219d66-6901-5ef5-bcd5-6bb66f6afbb7           2/2     2            2           3m58s
```

Watch Controller Pods Ready
```bash
kubectl get deploy -n pepr-system -l pepr.dev/controller=watcher 
NAME                                                READY   UP-TO-DATE   AVAILABLE   AGE
pepr-c8219d66-6901-5ef5-bcd5-6bb66f6afbb7-watcher   1/1     1            1           3m58s
```

## Phase 7 

Think of a security posture that you want to enforce at your company and create it by adding more mutations and validations to your webhooks.

#### [TOP](#optimizing-kubernetes-operators-and-admission-control-with-pepr)
