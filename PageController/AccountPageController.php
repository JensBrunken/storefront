<?php declare(strict_types=1);

namespace Shopware\Storefront\PageController;

use Shopware\Core\Checkout\Cart\Exception\CustomerNotLoggedInException as CustomerNotLoggedInExceptionAlias;
use Shopware\Core\Checkout\Customer\Exception\BadCredentialsException;
use Shopware\Core\Checkout\Customer\Storefront\AccountRegistrationService;
use Shopware\Core\Checkout\Customer\Storefront\AccountService;
use Shopware\Core\Framework\Routing\InternalRequest;
use Shopware\Core\Framework\Validation\DataBag\RequestDataBag;
use Shopware\Core\Framework\Validation\Exception\ConstraintViolationException;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Storefront\Framework\Controller\StorefrontController;
use Shopware\Storefront\Framework\Page\PageLoaderInterface;
use Shopware\Storefront\Page\Account\Address\AccountAddressPageLoader;
use Shopware\Storefront\Page\Account\AddressList\AccountAddressListPageLoader;
use Shopware\Storefront\Page\Account\Login\AccountLoginPageLoader;
use Shopware\Storefront\Page\Account\Order\AccountOrderPageLoader;
use Shopware\Storefront\Page\Account\Overview\AccountOverviewPageLoader;
use Shopware\Storefront\Page\Account\PaymentMethod\AccountPaymentMethodPageLoader;
use Shopware\Storefront\Page\Account\Profile\AccountProfilePageLoader;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;
use Symfony\Component\Routing\Annotation\Route;

class AccountPageController extends StorefrontController
{
    /**
     * @var AccountAddressListPageLoader|PageLoaderInterface
     */
    private $addressListPageLoader;

    /**
     * @var AccountLoginPageLoader|PageLoaderInterface
     */
    private $loginPageLoader;

    /**
     * @var AccountOverviewPageLoader|PageLoaderInterface
     */
    private $overviewPageLoader;

    /**
     * @var AccountProfilePageLoader|PageLoaderInterface
     */
    private $profilePageLoader;

    /**
     * @var AccountPaymentMethodPageLoader|PageLoaderInterface
     */
    private $paymentMethodPageLoader;

    /**
     * @var AccountOrderPageLoader|PageLoaderInterface
     */
    private $orderPageLoader;

    /**
     * @var AccountAddressPageLoader|PageLoaderInterface
     */
    private $addressPageLoader;

    /**
     * @var AccountService
     */
    private $accountService;

    /**
     * @var AccountRegistrationService
     */
    private $accountRegistrationService;

    public function __construct(
        PageLoaderInterface $accountLoginPageLoader,
        PageLoaderInterface $accountOverviewPageLoader,
        PageLoaderInterface $accountAddressPageLoader,
        PageLoaderInterface $accountProfilePageLoader,
        PageLoaderInterface $accountPaymentMethodPageLoader,
        PageLoaderInterface $accountOrderPageLoader,
        PageLoaderInterface $addressPageLoader,
        AccountService $accountService,
        AccountRegistrationService $accountRegistrationService
    ) {
        $this->loginPageLoader = $accountLoginPageLoader;
        $this->addressListPageLoader = $accountAddressPageLoader;
        $this->overviewPageLoader = $accountOverviewPageLoader;
        $this->profilePageLoader = $accountProfilePageLoader;
        $this->paymentMethodPageLoader = $accountPaymentMethodPageLoader;
        $this->orderPageLoader = $accountOrderPageLoader;
        $this->addressPageLoader = $addressPageLoader;
        $this->accountService = $accountService;
        $this->accountRegistrationService = $accountRegistrationService;
    }

    /**
     * @Route("/account", name="frontend.account.home.page", methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function index(InternalRequest $request, SalesChannelContext $context): Response
    {
        if (!$context->getCustomer()) {
            return $this->redirectToRoute('frontend.account.login.page');
        }

        $page = $this->overviewPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/index.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/login", name="frontend.account.login.page", methods={"GET"})
     */
    public function login(Request $request, InternalRequest $internal, SalesChannelContext $context): Response
    {
        /** @var string $redirect */
        $redirect = $request->get('redirectTo', $this->generateUrl('frontend.account.home.page'));

        if ($context->getCustomer()) {
            return $this->redirect($redirect);
        }

        $page = $this->loginPageLoader->load($internal, $context);

        return $this->renderStorefront('@Storefront/page/account/register/index.html.twig', [
            'redirectTo' => $redirect,
            'page' => $page,
            'loginError' => (bool) $request->get('loginError'),
        ]);
    }

    /**
     * @Route("/account/login", name="frontend.account.login", methods={"POST"})
     */
    public function loginCustomer(Request $request, RequestDataBag $data, SalesChannelContext $context): Response
    {
        $redirect = $request->get('redirectTo', $this->generateUrl('frontend.account.home.page'));

        if ($context->getCustomer()) {
            return $this->redirect($redirect);
        }

        try {
            $token = $this->accountService->loginWithPassword($data, $context);
            if (!empty($token)) {
                return new RedirectResponse($redirect);
            }
        } catch (BadCredentialsException | UnauthorizedHttpException $e) {
        }

        return $this->forward('Shopware\Storefront\PageController\AccountPageController::login', [
            'loginError' => true,
        ]);
    }

    /**
     * @Route("/account/register", name="frontend.account.register.page", methods={"GET"})
     */
    public function register(InternalRequest $request, RequestDataBag $data, SalesChannelContext $context): Response
    {
        if ($context->getCustomer()) {
            return $this->redirectToRoute('frontend.account.home.page');
        }

        $redirect = $request->optionalGet('redirectTo', $this->generateUrl('frontend.account.home.page'));

        $page = $this->loginPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/register/index.html.twig', ['redirectTo' => $redirect, 'page' => $page, 'data' => $data]);
    }

    /**
     * @Route("/account/register", name="frontend.account.register.save", methods={"POST"})
     */
    public function saveRegister(RequestDataBag $data, SalesChannelContext $context): Response
    {
        if ($context->getCustomer()) {
            return $this->redirectToRoute('frontend.account.home.page');
        }

        try {
            $this->accountRegistrationService->register($data, false, $context);
        } catch (ConstraintViolationException $formViolations) {
            return $this->forward('Shopware\Storefront\PageController\AccountPageController::register', ['formViolations' => $formViolations]);
        }

        $this->accountService->login($data->get('email'), $context);

        return new RedirectResponse($this->generateUrl('frontend.account.home.page'));
    }

    /**
     * @Route("/account/payment", name="frontend.account.payment.page", options={"seo"="false"}, methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function paymentOverview(InternalRequest $request, SalesChannelContext $context): Response
    {
        $this->denyAccessUnlessLoggedIn();

        $page = $this->paymentMethodPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/payment/index.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/order", name="frontend.account.order.page", options={"seo"="false"}, methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function orderOverview(InternalRequest $request, SalesChannelContext $context): Response
    {
        $this->denyAccessUnlessLoggedIn();

        $page = $this->orderPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/order-history/index.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/profile", name="frontend.account.profile.page", methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function profileOverview(InternalRequest $request, SalesChannelContext $context): Response
    {
        $this->denyAccessUnlessLoggedIn();

        $page = $this->profilePageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/profile/index.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/address", name="frontend.account.address.page", options={"seo"="false"}, methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function addressOverview(InternalRequest $request, SalesChannelContext $context): Response
    {
        $this->denyAccessUnlessLoggedIn();

        $page = $this->addressListPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/addressbook/index.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/address/create", name="frontend.account.address.create.page", options={"seo"="false"}, methods={"GET"})
     */
    public function createAddress(InternalRequest $request, SalesChannelContext $context): Response
    {
        $page = $this->addressPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/addressbook/create.html.twig', ['page' => $page]);
    }

    /**
     * @Route("/account/address/{addressId}", name="frontend.account.address.edit.page", options={"seo"="false"}, methods={"GET"})
     *
     * @throws CustomerNotLoggedInExceptionAlias
     */
    public function editAddress(InternalRequest $request, SalesChannelContext $context): Response
    {
        $this->denyAccessUnlessLoggedIn();

        $page = $this->addressPageLoader->load($request, $context);

        return $this->renderStorefront('@Storefront/page/account/addressbook/edit.html.twig', ['page' => $page]);
    }
}
