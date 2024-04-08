import { Capability, Log, sdk, a } from "pepr";
import { V1Container } from "@kubernetes/client-node";
import { WebApp } from "./crd/generated/webapp-v1alpha1";
import { validator } from "./crd/validator";
import { WebAppCRD } from "./crd/source/webapp.crd";
import { RegisterCRD } from "./crd/register";
import { reconciler } from "./reconciler";
import "./crd/register";
import Deploy from "./controller/generators";

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { When, Store, OnSchedule } = Admission;

const { containers } = sdk;

OnSchedule({
  name: "send-alerts",
  every: 10,
  unit: "seconds",
  run: () => {
    const lastIgnoreMe = Store.getItem("last-ignore-me");
    if (lastIgnoreMe) {
      Log.info(`Last ignored pod was ${lastIgnoreMe}`);
      Store.setItem("pass", lastIgnoreMe);
    }
  },
});

When(a.Pod)
  .IsCreatedOrUpdated()
  .Validate(po => {
    const podContainers = containers(po);
    for (const container of podContainers) {
      if (
        container.securityContext?.allowPrivilegeEscalation ||
        container.securityContext?.privileged
      ) {
        return po.Deny("Privilege escalation is not allowed");
      }
    }

    return po.Approve();
  });

const containerHelper = (container: V1Container) => {
  // set default if not there
  container.securityContext = container.securityContext || {};
  if (
    container.securityContext?.runAsUser &&
    container.securityContext?.runAsUser < 10
  ) {
    container.securityContext.runAsUser = 1000;
  } else if (!container.securityContext?.runAsUser) {
    container.securityContext.runAsUser = 655532;
  }
};
When(a.Pod)
  .IsCreatedOrUpdated()
  .Mutate(po => {
    if (!po.HasLabel("ignore-me")) {
      po.Raw.spec?.containers?.forEach(container => containerHelper(container));

      po.Raw.spec?.initContainers?.forEach(container =>
        containerHelper(container),
      );

      po.Raw.spec?.ephemeralContainers?.forEach(container =>
        containerHelper(container),
      );

      // define if not there
      po.Raw.spec.securityContext = po.Raw.spec.securityContext || {};

      if (
        po.Raw.spec.securityContext?.runAsUser &&
        po.Raw.spec.securityContext?.runAsUser < 10
      ) {
        po.Raw.spec.securityContext.runAsUser = 1000;
      } else if (!po.Raw.spec.securityContext?.runAsUser) {
        po.Raw.spec.securityContext.runAsUser = 655532;
      }
    } else {
      Store.setItem("last-ignore-me", po.Raw.metadata.name);
    }
  });

// When instance is created or updated, validate it and enqueue it for processing
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata.name, JSON.stringify(instance));
      await reconciler(instance);
    } catch (error) {
      Log.info(`Error reconciling instance of WebApp`);
    }
  });

When(WebApp)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata.name);
  });

// Don't let the CRD get deleted
When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName(WebAppCRD.metadata.name)
  .Watch(() => {
    RegisterCRD();
  });

// // Don't let them be deleted
When(a.Deployment)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async deploy => {
    const instance = JSON.parse(
      Store.getItem(deploy.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
When(a.Service)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async svc => {
    const instance = JSON.parse(
      Store.getItem(svc.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
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
